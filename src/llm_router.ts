import Groq from "groq-sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config.js";
import { toolDefinitions } from "./tools/index.js";

const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const openrouter = new OpenAI({
  apiKey: config.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// Google Gemini (tercer fallback) - solo se inicializa si hay API key
const gemini = config.GEMINI_API_KEY
  ? new GoogleGenerativeAI(config.GEMINI_API_KEY)
  : null;

export interface LLMRequest {
  messages: any[];
  useTools?: boolean;
}

/**
 * Convierte el formato de mensajes OpenAI al formato de Gemini.
 */
function convertToGeminiMessages(messages: any[]): { systemInstruction: string; contents: any[] } {
  let systemInstruction = "";
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction += (systemInstruction ? "\n" : "") + (msg.content || "");
    } else if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content || "" }] });
    } else if (msg.role === "assistant") {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      // Convertir tool_calls a functionCall parts de Gemini
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          const fn = tc.function || tc;
          let args = {};
          try { args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : (fn.arguments || {}); } catch { args = {}; }
          parts.push({ functionCall: { name: fn.name, args } });
        }
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
    } else if (msg.role === "tool") {
      // Gemini usa functionResponse
      contents.push({
        role: "function",
        parts: [{
          functionResponse: {
            name: msg.name || "tool_result",
            response: { content: msg.content || "" }
          }
        }]
      });
    }
  }

  return { systemInstruction, contents };
}

/**
 * Convierte las definiciones de tools al formato de Gemini.
 */
function convertToGeminiTools(toolDefs: any[]): any[] {
  return toolDefs.map(td => {
    const fn = td.function;
    // Gemini no acepta 'additionalProperties' en los parámetros, hay que limpiarlo
    const params = { ...fn.parameters };
    delete params.additionalProperties;
    return {
      name: fn.name,
      description: fn.description,
      parameters: params,
    };
  });
}

/**
 * Llama a Google Gemini y devuelve la respuesta en formato compatible con OpenAI.
 */
async function callGemini(messages: any[], useTools: boolean) {
  if (!gemini) throw new Error("Gemini no configurado (falta GEMINI_API_KEY).");

  const { systemInstruction, contents } = convertToGeminiMessages(messages);

  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemInstruction || undefined,
    tools: useTools ? [{ functionDeclarations: convertToGeminiTools(toolDefinitions) }] : undefined,
  } as any);

  const result = await model.generateContent({ contents });
  const response = result.response;
  const candidate = response.candidates?.[0];

  if (!candidate?.content?.parts) {
    throw new Error("Gemini devolvió respuesta vacía.");
  }

  // Convertir respuesta de Gemini a formato OpenAI
  let content = "";
  const tool_calls: any[] = [];

  for (const part of candidate.content.parts) {
    if (part.text) {
      content += part.text;
    }
    if (part.functionCall) {
      tool_calls.push({
        id: "call_" + Math.random().toString(36).substring(7),
        type: "function",
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
        }
      });
    }
  }

  return {
    role: "assistant" as const,
    content: content || null,
    tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
  };
}

export async function getCompletion(request: LLMRequest) {
  const { messages, useTools } = request;

  // 1️⃣ Intento con Groq (principal)
  try {
    console.log(`[LLM] Llamando a Groq con ${messages.length} mensajes...`);
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      tools: useTools ? toolDefinitions as any : undefined,
      tool_choice: useTools ? "auto" : undefined,
    });
    
    const message = response.choices[0]?.message;
    if (!message) throw new Error("Groq devolvió choices vacío.");
    
    console.log("✅ [LLM] Groq exitoso.");
    return message;
  } catch (err: any) {
    console.error(`❌ [LLM] Groq falló: ${err.message}`);
    
    // 2️⃣ Fallback a OpenRouter
    try {
      console.log(`[LLM] Fallback a OpenRouter (${config.OPENROUTER_MODEL})...`);
      const response = await openrouter.chat.completions.create({
        model: config.OPENROUTER_MODEL,
        messages,
        tools: (useTools && !config.OPENROUTER_MODEL.includes("free")) ? toolDefinitions as any : undefined,
        tool_choice: (useTools && !config.OPENROUTER_MODEL.includes("free")) ? "auto" : undefined,
      });

      const message = response.choices[0]?.message;
      if (!message) throw new Error("OpenRouter devolvió choices vacío.");

      console.log("✅ [LLM] OpenRouter exitoso.");
      return message;
    } catch (fallbackErr: any) {
      console.error(`❌ [LLM] OpenRouter falló: ${fallbackErr.message}`);

      // 3️⃣ Último recurso: Google Gemini
      try {
        console.log(`[LLM] Último fallback: Google Gemini...`);
        const message = await callGemini(messages, useTools || false);
        console.log("✅ [LLM] Gemini exitoso.");
        return message;
      } catch (geminiErr: any) {
        console.error(`❌ [LLM] Gemini también falló: ${geminiErr.message}`);
        throw new Error(
          `Servicios de IA no disponibles. Groq: ${err.message}. OpenRouter: ${fallbackErr.message}. Gemini: ${geminiErr.message}`
        );
      }
    }
  }
}
