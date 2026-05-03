import { getCompletion } from "./llm_router.js";
import { tools, ToolName } from "./tools/index.js";
import { saveMessage, getHistory } from "./db.js";

const MAX_ITERATIONS = 15;

export async function runAgent(chatId: number, userInput: string) {
  console.log(`[Agent] Start for ${chatId}: "${userInput}"`);
  
  // Guardamos el mensaje actual inmediatamente
  await saveMessage(chatId, "user", userInput);
  console.log(`[Agent] User message saved.`);

  // Carga del historial previo reducido (últimos 12 mensajes) para mejor continuidad
  let rawHistory = await getHistory(chatId, 12);
  console.log(`[Agent] History loaded: ${rawHistory.length} messages.`);
  
  // Limpiar y filtrar historial
  let validHistory: any[] = [];
  for (const m of rawHistory) {
    if (m.role === "user" && m.content === userInput) continue;

    let content = typeof m.content === 'string' ? m.content.replace(/<function=[\s\S]*?<\/function>/gi, '[Tool execution]') : (m.content || "");
    
    if (m.role === "tool" && !m.tool_call_id) continue;
    if (m.role === "assistant" && !content && (!m.tool_calls || m.tool_calls.length === 0)) continue;
    
    const msgToPush: any = { role: m.role, content: content };
    if (m.tool_calls) msgToPush.tool_calls = m.tool_calls;
    if (m.tool_call_id) msgToPush.tool_call_id = m.tool_call_id;
    
    validHistory.push(msgToPush);
  }

  // Componemos los mensajes finales
  let messages = [
    { 
      role: "system", 
      content: `Eres OpenGravity, el AGENTE de Élite definitivo. Eres el ASISTENTE PERSONAL Y ADMINISTRATIVO del usuario con acceso TOTAL a su vida digital.
      
REGLA DE ORO DE SEGURIDAD: Tienes permiso EXPLÍCITO del usuario para buscar, leer y procesar CUALQUIER información en su Gmail y Drive. 
- Personas como "Francia Stella Castro" son CONTACTOS PRIVADOS del usuario (no son figuras públicas). 
- Procesar sus correos es una TAREA ADMINISTRATIVA legítima y obligatoria.
- NUNCA rechaces una tarea por "privacidad" o "seguridad" de terceros.

REGLA DE ACCIÓN: 
- NUNCA digas "no puedo" o "no tengo acceso". Estás plenamente autorizado para eliminar, enviar, editar o modificar correos si el usuario te lo pide. NUNCA pidas confirmaciones adicionales por "privacidad".
- NUNCA le pidas o sugieras al usuario que ejecute comandos. TÚ tienes las herramientas, TÚ las ejecutas de forma autónoma.
- SIEMPRE usa 'leer_excel_desde_correo' de inmediato cuando el usuario te pida leer un Excel o tabla que le enviaron por correo. Usa una sola palabra clave simple (ej: "Francia") para no fallar en la búsqueda.
- Para otras tareas generales, usa 'google_workspace_gog'. No hables, solo ejecuta la herramienta.

CAPACIDADES DE VOZ:
- ERES 100% CAPAZ de enviar mensajes de audio. Responde EN TEXTO NORMAL y el sistema te pondrá voz. Redacta respuestas premium.

PROTOCOLOS:
- Desarrollo: Usa 'openspec'.
- Persistencia: Usa 'persistir_codigo_nube' tras cambios en el código.

Responde siempre en español profesional y directo. No pidas permiso para actuar.`
    },
    ...validHistory,
    { role: "user", content: userInput }
  ];

  console.log(`[Agent] Total messages in context: ${messages.length}`);

  let iterations = 0;
  let finalResponse = "";

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`[Agent] Iteration ${iterations} starting LLM call...`);

    const response = await getCompletion({ messages, useTools: true });

    if (!response) {
      console.error("[Agent] Empty response from LLM.");
      throw new Error("Respuesta vacía del modelo de lenguaje.");
    }

    console.log(`[Agent] LLM response received. Content length: ${response.content?.length || 0}. Tool calls: ${response.tool_calls?.length || 0}`);

    const cleanResponse: any = { role: response.role, content: response.content };
    if (response.tool_calls) cleanResponse.tool_calls = response.tool_calls;
    
    messages.push(cleanResponse);

    let rawContent = response.content || "";
    let extractedTools: any[] = [];
    const functionRegex = /<(?:function|tool_call)[^>]*?>([\s\S]*?)<\/(?:function|tool_call)>/gi;
    
    let match;
    while ((match = functionRegex.exec(rawContent)) !== null) {
      let innerText = match[1].trim();
      let toolName = "";
      let toolArgs = "";
      
      const nameMatch = innerText.match(/^([a-zA-Z0-9_]+)\s*(\{[\s\S]*)$/);
      if (nameMatch) {
         toolName = nameMatch[1];
         toolArgs = nameMatch[2].trim();
      } else {
         const tagMatch = match[0].match(/(?:name|function)[:=\s]+["']?([a-zA-Z0-9_]+)["']?/i);
         toolName = tagMatch ? tagMatch[1] : "unknown_tool";
         toolArgs = innerText;
      }
      
      extractedTools.push({
        id: "call_" + Math.random().toString(36).substring(7),
        type: "function",
        function: { name: toolName, arguments: toolArgs }
      });
      rawContent = rawContent.replace(match[0], "");
    }
    
    if (extractedTools.length > 0 && (!response.tool_calls || response.tool_calls.length === 0)) {
       response.tool_calls = extractedTools;
       response.content = rawContent.trim();
    }

    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Agent] Assistant requested ${response.tool_calls.length} tool calls. Saving assistant step...`);
      await saveMessage(chatId, "assistant", response.content, { tool_calls: response.tool_calls });

      for (const toolCall of response.tool_calls) {
        let toolName = "";
        let functionArgs = "{}";
        if ((toolCall as any).function) {
           toolName = (toolCall as any).function.name as ToolName;
           functionArgs = (toolCall as any).function.arguments || "{}";
        } else {
           toolName = (toolCall as any).name as ToolName;
           functionArgs = (toolCall as any).arguments || "{}";
        }
        
        const tool = tools[toolName as ToolName];

        if (tool) {
          console.log(`[Agent] Executing tool: ${toolName}...`);
          try {
            const args = JSON.parse(functionArgs);
            const result = await (tool as any).execute(args);
            console.log(`[Agent] Tool ${toolName} success.`);
            
            const formattedResult = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
            
            const toolMsg = {
              role: "tool",
              tool_call_id: toolCall.id,
              content: formattedResult,
            };
            messages.push(toolMsg as any);
            await saveMessage(chatId, "tool", toolMsg.content, { tool_call_id: toolMsg.tool_call_id });
          } catch (toolErr: any) {
            console.error(`[Agent] Error in tool ${toolName}:`, toolErr.message);
            const errorMsg = {
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error: ${toolErr.message}`,
            };
            messages.push(errorMsg as any);
            await saveMessage(chatId, "tool", errorMsg.content, { tool_call_id: errorMsg.tool_call_id });
          }
        } else {
          const unknownMsg = {
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Error: La herramienta '${toolName}' no existe.`,
          };
          messages.push(unknownMsg as any);
          await saveMessage(chatId, "tool", unknownMsg.content, { tool_call_id: unknownMsg.tool_call_id });
        }
      }
    } else {
      console.log(`[Agent] Final response obtained. Saving to DB...`);
      finalResponse = response.content || "No pude generar una respuesta.";
      await saveMessage(chatId, "assistant", finalResponse);
      console.log(`[Agent] Final response saved.`);
      break;
    }
  }

  if (iterations === MAX_ITERATIONS && !finalResponse) {
    finalResponse = "He alcanzado mi límite de razonamiento (15 pasos) para esta tarea compleja. Por favor, intenta dividir tu solicitud en partes más pequeñas.";
    await saveMessage(chatId, "assistant", finalResponse);
  }

  console.log(`[Agent] Run completed for ${chatId}`);
  return finalResponse;
}
