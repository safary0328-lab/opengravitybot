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

// Google Gemini fallback
// (Instanciación dinámica para evitar problemas con dotenv watch)

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
async function callGemini(messages: any[], useTools: boolean, modelName: string = "gemini-2.0-flash") {
  const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini no configurado (falta GEMINI_API_KEY en .env).");
  
  const gemini = new GoogleGenerativeAI(apiKey);

  const { systemInstruction, contents } = convertToGeminiMessages(messages);

  const model = gemini.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction || undefined,
    tools: useTools ? [{ functionDeclarations: convertToGeminiTools(toolDefinitions) }] : undefined,
  } as any);

  const result = await model.generateContent({ contents });
  const response = result.response;
  const candidate = response.candidates?.[0];

  if (!candidate?.content?.parts) {
    throw new Error(`Gemini (${modelName}) devolvió respuesta vacía.`);
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

  const strategies = [
    // 1. Gemini directo (más obediente con herramientas y datos personales)
    { provider: "gemini", model: "gemini-2.0-flash" },
    { provider: "gemini", model: "gemini-1.5-flash" },

    // 2. Groq (muy rápido para respuestas simples)
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "groq", model: "llama-3.1-8b-instant" },

    // 3. OpenRouter (Resiliencia Extrema - varios modelos de respaldo)
    { provider: "openrouter", model: "google/gemini-2.0-flash-001" },
    { provider: "openrouter", model: "deepseek/deepseek-chat" },
    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
    { provider: "openrouter", model: "qwen/qwen-2.5-72b-instruct" },
    { provider: "openrouter", model: "mistralai/mistral-7b-instruct" },
    { provider: "openrouter", model: "openrouter/auto" },
  ];

  const errors: string[] = [];

  for (const strategy of strategies) {
    try {
      console.log(`[LLM] Intentando ${strategy.provider} con ${strategy.model}...`);
      
      if (strategy.provider === "groq") {
        const response = await groq.chat.completions.create({
          model: strategy.model,
          messages,
          tools: useTools ? toolDefinitions as any : undefined,
          tool_choice: useTools ? "auto" : undefined,
        });
        const message = response.choices[0]?.message;
        if (!message) throw new Error("Vacio");
        console.log(`✅ [LLM] ${strategy.provider}/${strategy.model} exitoso.`);
        return message;
      } 
      
      if (strategy.provider === "gemini") {
        const message = await callGemini(messages, useTools || false, strategy.model);
        console.log(`✅ [LLM] ${strategy.provider}/${strategy.model} exitoso.`);
        return message;
      }

      if (strategy.provider === "openrouter") {
        const response = await openrouter.chat.completions.create({
          model: strategy.model,
          messages,
          // Solo enviar tools si NO es un modelo free común o si sabemos que lo soporta
          tools: useTools ? toolDefinitions as any : undefined,
          tool_choice: useTools ? "auto" : undefined,
        });
        const message = response.choices[0]?.message;
        if (!message) throw new Error("Vacio");
        console.log(`✅ [LLM] ${strategy.provider}/${strategy.model} exitoso.`);
        return message;
      }

    } catch (err: any) {
      const msg = err.message || "Error desconocido";
      console.error(`❌ [LLM] ${strategy.provider}/${strategy.model} falló: ${msg.substring(0, 100)}...`);
      errors.push(`${strategy.provider}/${strategy.model}: ${msg}`);
      // Continuar al siguiente strategy
    }
  }

  // Si llegamos aquí, todo falló
  throw new Error(`Servicios de IA no disponibles (Todos fallaron):\n${errors.join("\n")}`);
}
