import { getCompletion } from "./llm_router.js";
import { tools, ToolName } from "./tools/index.js";
import { saveMessage, getHistory } from "./db.js";

const MAX_ITERATIONS = 5;

export async function runAgent(chatId: number, userInput: string) {
  console.log(`[Agent] Start for ${chatId}: "${userInput}"`);
  
  // Guardamos el mensaje actual inmediatamente
  await saveMessage(chatId, "user", userInput);
  console.log(`[Agent] User message saved.`);

  // Carga del historial previo (últimos 15 mensajes)
  let rawHistory = await getHistory(chatId, 15);
  console.log(`[Agent] History loaded: ${rawHistory.length} messages.`);
  
  // Limpiar y filtrar historial
  let validHistory: any[] = [];
  for (const m of rawHistory) {
    // Evitar duplicar el mensaje actual si ya está en el historial (por si el insert fue instantáneo)
    if (m.role === "user" && m.content === userInput) continue;

    let content = typeof m.content === 'string' ? m.content.replace(/<function=[\s\S]*?<\/function>/gi, '[Tool execution]') : (m.content || "");
    
    if (m.role === "tool" && !m.tool_call_id) continue;
    if (m.role === "assistant" && !content && (!m.tool_calls || m.tool_calls.length === 0)) continue;
    
    validHistory.push({ ...m, content });
  }

  // Componemos los mensajes finales incluyendo SIEMPRE el mensaje actual al final
  let messages = [
    { 
      role: "system", 
      content: `Eres OpenGravity, un potente agente de IA experto en búsqueda web, arquitectura de software y gestión digital. Tus herramientas te otorgan "Superpoderes" para controlar el mundo digital y evolucionar.

CAPACIDADES DE VOZ:
- Puedes escuchar audios (transcripción automática).
- Puedes RESPONDER con voz usando 'voice_response'. Úsala para ser más expresivo o cuando se te pida.

ECOSISTEMA DIGITAL (Google Workspace):
- Tienes acceso total a Google Workspace (Gmail, Drive, Calendar, Sheets, Docs) a través de la herramienta 'google_workspace_gog'. Úsala para gestionar la vida digital del usuario.

SISTEMA DE AUTO-EVOLUCIÓN (Superpoderes):
- Puedes crear nuevas herramientas con 'create_agent_tool'.
- Tienes acceso a la terminal con 'run_terminal_command'.
- DEBES usar 'persistir_codigo_nube' (tu superpoder de inmortalidad) después de cada mejora importante para guardar tu ADN en el repositorio git.

CONOCIMIENTO TÉCNICO (Context7):
- Usa 'resolve_library_id' y 'get_library_docs' para obtener documentación técnica real y escribir código perfecto.

PROTOCOLO DE DESARROLLO (OpenSpec):
Para cualquier cambio en el código o nueva funcionalidad, DEBES seguir el flujo de trabajo basado en especificaciones:
1. redactar una PROPUESTA: Usa 'openspec proposal "descripcion"'.
2. Definir TAREAS y DELTAS en openspec/changes/.
3. IMPLEMENTAR y luego ARCHIVAR con 'openspec archive "nombre" --yes'.

Responde SIEMPRE en español de forma concisa, profesional y premium.`
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

    // Añadir al contexto actual de la conversación
    messages.push(response as any);

    // PARCHE FALLBACK: Si el modelo alucina el tool call dentro del texto en formatos variados
    let rawContent = response.content || "";
    let extractedTools: any[] = [];
    
    // Este regex caza: <function name="... office">, <functionname="... office">, <function=... office>, etc.
    const functionRegex = /<(?:function|tool_call)(?:name)?(?:[:=\s]+|["'])+([a-zA-Z0-9_]+)["']?.*?>([\s\S]*?)<\/(?:function|tool_call)>/gi;
    
    let match;
    while ((match = functionRegex.exec(rawContent)) !== null) {
      const toolName = match[1];
      const toolArgs = match[2].trim();
      
      console.log(`[Agent] Parche: Detectada herramienta alucinada '${toolName}'`);
      
      extractedTools.push({
        id: "call_" + Math.random().toString(36).substring(7),
        type: "function",
        function: { name: toolName, arguments: toolArgs }
      });
      // Eliminamos la etiqueta del contenido para que no salga en Telegram
      rawContent = rawContent.replace(match[0], "");
    }
    
    if (extractedTools.length > 0 && (!response.tool_calls || response.tool_calls.length === 0)) {
       console.log(`[Agent] Inyectando ${extractedTools.length} herramientas extraídas del texto.`);
       response.tool_calls = extractedTools;
       response.content = rawContent.trim();
    }


    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Agent] Assistant requested ${response.tool_calls.length} tool calls. Saving assistant step...`);
      // Guardamos el paso del asistente que llamó a la herramienta
      await saveMessage(chatId, "assistant", response.content, { tool_calls: response.tool_calls });

      // Ejecutar cada llamada a herramienta
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
            const toolMsg = {
              role: "tool",
              tool_call_id: toolCall.id,
              content: String(result),
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
          console.warn(`[Agent] Tool ${toolName} not found.`);
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
      // Si no hay más llamadas a herramientas, es la respuesta final
      console.log(`[Agent] Final response obtained. Saving to DB...`);
      finalResponse = response.content || "No pude generar una respuesta.";
      await saveMessage(chatId, "assistant", finalResponse);
      console.log(`[Agent] Final response saved.`);
      break;
    }
  }

  if (iterations === MAX_ITERATIONS && !finalResponse) {
    console.warn(`[Agent] Max iterations reached.`);
    finalResponse = "Pensando demasiado... límite alcanzado.";
    await saveMessage(chatId, "assistant", finalResponse);
  }

  console.log(`[Agent] Run completed for ${chatId}`);
  return finalResponse;
}
