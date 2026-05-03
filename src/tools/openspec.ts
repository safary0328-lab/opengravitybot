import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const openspec = {
  name: "openspec",
  description: "Framework de desarrollo profesional. Úsalo para gestionar el ciclo de vida de tus tareas: crear propuestas, definir tareas técnicas y archivar cambios. Obligatorio para cualquier mejora en el código.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "El comando de openspec a ejecutar: 'proposal \"desc\"', 'archive \"nombre\" --yes', etc.",
      },
    },
    required: ["command"],
  },
  execute: async (args: { command: string }) => {
    try {
      // Determinamos el comando base (openspec suele estar en el path en el Docker de HF, o podemos usar npx)
      const { stdout, stderr } = await execAsync(`openspec ${args.command}`);
      return stdout || stderr || "Comandado ejecutado con éxito.";
    } catch (error: any) {
      // Fallback a npx si no está global
      try {
        const { stdout, stderr } = await execAsync(`npx openspec ${args.command}`);
        return stdout || stderr || "Comandado ejecutado con éxito (vía npx).";
      } catch (npxError: any) {
        return `Error ejecutando OpenSpec: ${error.message}. Detalle: ${error.stderr || ""}`;
      }
    }
  }
};
