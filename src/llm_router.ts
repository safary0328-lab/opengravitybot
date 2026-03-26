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
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      tools: useTools ? toolDefinitions as any : undefined,
      tool_choice: useTools ? "auto" : undefined,
    });
    console.log("LLM: Groq call successful.");
    return response.choices[0].message;
  } catch (err: any) {
    console.error(`LLM: Groq failed (${err.message}). Falling back to OpenRouter...`);
    
    // Fallback to OpenRouter
    try {
      const response = await openrouter.chat.completions.create({
        model: config.OPENROUTER_MODEL,
        messages,
        tools: useTools ? toolDefinitions as any : undefined,
        tool_choice: useTools ? "auto" : undefined,
      });
      console.log("LLM: OpenRouter call successful.");
      return response.choices[0].message;
    } catch (fallbackErr: any) {
      console.error(`LLM: OpenRouter failed too (${fallbackErr.message}).`);
      throw new Error(`All LLM services failed: Groq(${err.message}), OpenRouter(${fallbackErr.message})`);
    }
  }
}
