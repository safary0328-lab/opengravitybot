import { extraer_formulas_google_sheets } from "./extraer_formulas_google_sheets.js";
import { ajustar_app_calorias } from "./ajustar_app_calorias.js";
import { leer_excel_desde_correo } from "./leer_excel_desde_correo.js";
import { procesar_comida_y_calorias } from "./procesar_comida_y_calorias.js";
import { detectar_comida_en_foto } from "./detectar_comida_en_foto.js";
import { analizador_de_comidas } from "./analizador_de_comidas.js";
import { mejorar_sistema_de_memoria } from "./mejorar_sistema_de_memoria.js";
import { organizador_de_archivos } from "./organizador_de_archivos.js";
import { obtener_clima } from "./obtener_clima.js";
import { get_current_time } from "./get_current_time.js";
import { web_search } from "./web_search.js";
import { google_workspace_gog } from "./gog_cli.js";
import { create_agent_tool } from "./create_agent_tool.js";
import { run_terminal_command } from "./run_terminal_command.js";
import { write_system_file } from "./write_system_file.js";
import { persistir_codigo_nube } from "./persistir_codigo_nube.js";
import { voice_response } from "./voice_response.js";
import { list_directory } from "./list_directory.js";
import { read_file } from "./read_file.js";
import { openspec } from "./openspec.js";
import { spawn } from "child_process";

/**
 * Ejecuta una herramienta MCP manejando el protocolo de inicialización completo.
 */
async function callMCPTool(toolName: string, toolArgs: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["-y", "@upstash/context7-mcp@latest"], { shell: true });
    let step = "initialize";
    let buffer = "";

    child.stdout.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Mantener el último fragmento incompleto
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
          const json = JSON.parse(trimmed);
          
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
        } catch (e) {
          console.warn("⚠️ Error parseando línea MCP:", trimmed.substring(0, 50));
        }
      }
    });

    child.on("error", (err) => {
      console.error("❌ Error de proceso MCP:", err.message);
      reject(err);
    });

    // Timeout de seguridad de 45 segundos (npx puede tardar)
    setTimeout(() => {
        child.kill();
        resolve("Error: Tiempo de espera agotado conectando con Context7.");
    }, 45000);
    
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
  obtener_clima,
  organizador_de_archivos,
  list_directory,
  read_file,
  openspec,
  voice_response,
  mejorar_sistema_de_memoria,
  analizador_de_comidas,
  detectar_comida_en_foto,
  procesar_comida_y_calorias,
  ajustar_app_calorias,
  leer_excel_desde_correo,
  extraer_formulas_google_sheets
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
