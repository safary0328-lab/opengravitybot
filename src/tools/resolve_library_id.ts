import { spawnSync } from "child_process";

/**
 * Herramienta Context7: Resuelve un nombre de librería a un ID compatible.
 */
export const resolve_library_id = {
  name: "resolve_library_id",
  description: "Resuelve el nombre de una librería (ej: 'grammy', 'openai', 'react') a un ID compatible con Context7 para luego obtener su documentación.",
  parameters: {
    type: "object",
    properties: {
      libraryName: {
        type: "string",
        description: "El nombre de la biblioteca técnica a buscar."
      }
    },
    required: ["libraryName"]
  },
  execute: async ({ libraryName }: { libraryName: string }) => {
    try {
      console.log(`[Context7] Resolviendo ID para: ${libraryName}...`);
      
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "resolve-library-id",
          arguments: { libraryName }
        }
      });

      const result = spawnSync("npx", ["-y", "@upstash/context7-mcp@latest"], {
        input: payload + "\n",
        encoding: "utf-8",
        shell: true
      });

      if (result.error) throw result.error;

      const lines = result.stdout.split("\n");
      for (const line of lines) {
        if (line.trim().startsWith('{"jsonrpc"')) {
          const response = JSON.parse(line);
          if (response.result?.content?.[0]?.text) {
            return response.result.content[0].text;
          }
        }
      }
      
      return "No se encontró el ID en la respuesta del servidor.";
    } catch (error: any) {
      return `Error de conexión MCP: ${error.message}`;
    }
  }
};


