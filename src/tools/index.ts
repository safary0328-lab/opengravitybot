import { organizador_de_archivos } from "./organizador_de_archivos.js";
import { obtener_clima } from "./obtener_clima.js";
import { get_current_time } from "./get_current_time.js";
import { web_search } from "./web_search.js";
import { google_workspace_gog } from "./gog_cli.js";
import { create_agent_tool } from "./create_agent_tool.js";
import { run_terminal_command } from "./run_terminal_command.js";
import { write_system_file } from "./write_system_file.js";
import { persistir_codigo_nube } from "./persistir_codigo_nube.js";
import { spawn } from "child_process";

/**
 * Ejecuta una herramienta MCP manejando el protocolo de inicialización completo.
 */
async function callMCPTool(toolName: string, toolArgs: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["-y", "@upstash/context7-mcp@latest"], { shell: true });
    let step = "initialize";

    child.stdout.on("data", (data) => {
      const respStr = data.toString();
      const lines = respStr.split("\n");
      
      for (const line of lines) {
        if (!line.trim().startsWith("{")) continue;
        try {
          const json = JSON.parse(line);
          
          if (step === "initialize" && json.result) {
            step = "callTool";
            child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
            child.stdin.write(JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "tools/call",
              params: { name: toolName, arguments: toolArgs }
            }) + "\n");
          } else if (step === "callTool" && json.id === 2) {
            const text = json.result?.content?.[0]?.text;
            resolve(text || "Respuesta sin contenido.");
            child.kill();
          }
        } catch (e) {}
      }
    });

    child.on("error", (err) => {
      reject(err);
    });

    // Timeout de seguridad de 30 segundos
    setTimeout(() => {
        child.kill();
        resolve("Error: Tiempo de espera agotado conectando con Context7.");
    }, 30000);
    
    // Iniciar handshake
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "OpenGravity", version: "1.0.0" } }
    }) + "\n");
  });
}

export const resolve_library_id = {
  name: "resolve_library_id",
  description: "Resuelve el nombre de una librería (ej: 'grammy') a un ID compatible con Context7.",
  parameters: {
    type: "object",
    properties: { libraryName: { type: "string" } },
    required: ["libraryName"]
  },
  execute: async ({ libraryName }: { libraryName: string }) => {
    try {
      // Ajustado de nuevo a libraryName según el último mensaje del servidor
      return await callMCPTool("resolve-library-id", { libraryName: libraryName });
    } catch (error: any) {
      return `Error MCP: ${error.message}`;
    }
  }
};


export const get_library_docs = {
  name: "get_library_docs",
  description: "Obtiene la documentación técnica actualizada de una librería usando su ID.",
  parameters: {
    type: "object",
    properties: { 
      libraryId: { type: "string" },
      topic: { type: "string" }
    },
    required: ["libraryId"]
  },
  execute: async ({ libraryId, topic }: { libraryId: string, topic?: string }) => {
    try {
      return await callMCPTool("get-library-docs", { 
        libraryId: libraryId,
        topic: topic || ""
      });
    } catch (error: any) {
      return `Error MCP: ${error.message}`;
    }
  }
};

/**
 * Registro de herramientas disponibles para el Agente OpenGravity.
 */
export const tools = {
  get_current_time,
  web_search,
  google_workspace_gog,
  create_agent_tool,
  run_terminal_command,
  write_system_file,
  persistir_codigo_nube,
  resolve_library_id,
  get_library_docs,
  obtener_clima
,
  organizador_de_archivos
};

export type ToolName = keyof typeof tools;

/**
 * Definiciones de herramientas formateadas para el modelo de lenguaje (LLM).
 */
export const toolDefinitions = Object.values(tools).map(t => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }
}));
