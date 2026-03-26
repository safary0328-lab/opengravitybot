import { getCompletion } from "./llm_router.js";
import { tools, ToolName } from "./tools/index.js";
import { saveMessage, getHistory } from "./db.js";

const MAX_ITERATIONS = 5;

export async function runAgent(chatId: number, userInput: string) {
  // Save user message
  await saveMessage(chatId, "user", userInput);

  // Carga del historial desde la nube
  let messages = [
    { role: "system", content: "Eres OpenGravity, un potente agente de IA experto en búsqueda web y asistencia personal. Piensa antes de actuar, usa las herramientas si es necesario para dar información actual y responde SIEMPRE en español de forma concisa y premium." },
    ...(await getHistory(chatId))
  ];

  let iterations = 0;
  let finalResponse = "";

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await getCompletion({ messages, useTools: true });

    if (!response) {
      throw new Error("Empty response from LLM");
    }

    // Add assistant's thought/response to messages for next possible iteration
    messages.push(response as any);

    if (response.tool_calls && response.tool_calls.length > 0) {
      // Execute all tool calls
      for (const toolCall of response.tool_calls) {
        const toolName = (toolCall as any).function.name as ToolName;
        const tool = tools[toolName];

        if (tool) {
          console.log(`Executing tool: ${toolName}...`);
          try {
            const args = JSON.parse((toolCall as any).function.arguments || "{}");
            const result = await (tool as any).execute(args);
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            } as any);
          } catch (toolErr: any) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error executing tool: ${toolErr.message}`,
            } as any);
          }
        }
      }
      // Continue loop to let LLM process tool results
    } else {
      // Final response obtained
      finalResponse = response.content || "I couldn't generate a response.";
      await saveMessage(chatId, "assistant", finalResponse);
      break;
    }
  }

  if (iterations === MAX_ITERATIONS && !finalResponse) {
    console.warn("Agente: Se alcanzó el límite de iteraciones sin respuesta final.");
    finalResponse = "Pensando demasiado... límite alcanzado. Por favor, intenta algo más simple.";
    await saveMessage(chatId, "assistant", finalResponse);
  }

  return finalResponse;
}
