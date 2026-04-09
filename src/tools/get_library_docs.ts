import { spawnSync } from "child_process";

/**
 * Herramienta Context7: Obtiene documentación actualizada de una librería.
 */
export const get_library_docs = {
  name: "get_library_docs",
  description: "Obtiene documentación técnica actualizada, ejemplos de código y API references directamente de la fuente.",
  parameters: {
    type: "object",
    properties: {
      libraryId: {
        type: "string",
        description: "El ID de la librería obtenido previamente con 'resolve_library_id'."
      },
      topic: {
        type: "string",
        description: "Opcional. Un tema específico (ej: 'routing', 'auth', 'database')."
      }
    },
    required: ["libraryId"]
  },
  execute: async ({ libraryId, topic }: { libraryId: string, topic?: string }) => {
    try {
      console.log(`[Context7] Obteniendo docs para ${libraryId}${topic ? ` (Tema: ${topic})` : ""}...`);
      
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "get-library-docs",
          arguments: {
            context7CompatibleLibraryID: libraryId,
            topic: topic || "",
            tokens: 10000
          }
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
      
      return "No se pudo interpretar la respuesta del servidor MCP.";
    } catch (error: any) {
      return `Error de conexión MCP: ${error.message}`;
    }
  }
};


