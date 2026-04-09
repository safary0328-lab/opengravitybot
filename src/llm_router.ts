import Groq from "groq-sdk";
import OpenAI from "openai";
import { config } from "./config.js";
import { toolDefinitions } from "./tools/index.js";

const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const openrouter = new OpenAI({
  apiKey: config.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export interface LLMRequest {
  messages: any[];
  useTools?: boolean;
}

export async function getCompletion(request: LLMRequest) {
  const { messages, useTools } = request;

  // Attempt Groq first
  try {
    console.log(`[LLM] Calling Groq with ${messages.length} messages...`);
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      tools: useTools ? toolDefinitions as any : undefined,
      tool_choice: useTools ? "auto" : undefined,
    });
    
    const message = response.choices[0]?.message;
    if (!message) throw new Error("Groq returned empty choices.");
    
    console.log("LLM: Groq call successful.");
    return message;
  } catch (err: any) {
    console.error(`LLM: Groq failed (${err.message}).`);
    
    // Fallback to OpenRouter
    try {
      console.log(`[LLM] Falling back to OpenRouter (${config.OPENROUTER_MODEL})...`);
      const response = await openrouter.chat.completions.create({
        model: config.OPENROUTER_MODEL,
        messages,
        // No enviamos herramientas a OpenRouter free a menos que sepamos que las soporta. 
        // Si el modelo es 'openrouter/free', es mejor no enviar tools para evitar error 400.
        tools: (useTools && !config.OPENROUTER_MODEL.includes("free")) ? toolDefinitions as any : undefined,
        tool_choice: (useTools && !config.OPENROUTER_MODEL.includes("free")) ? "auto" : undefined,
      });

      const message = response.choices[0]?.message;
      if (!message) throw new Error("OpenRouter returned empty choices.");

      console.log("LLM: OpenRouter call successful.");
      return message;
    } catch (fallbackErr: any) {
      console.error(`LLM: OpenRouter failed too (${fallbackErr.message}).`);
      throw new Error(`Servicios de IA no disponibles. Groq: ${err.message}. OpenRouter: ${fallbackErr.message}`);
    }
  }
}

