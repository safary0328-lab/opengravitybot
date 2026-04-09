import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const run_terminal_command = {
  name: "run_terminal_command",
  description: "Ejecuta comandos reales de terminal (Linux/Unix en la nube). IMPORTANTE: No intentes usar 'cd' como comando independiente, en su lugar utiliza el parámetro opcional 'cwd' para cambiar de directorio. En la nube de Hugging Face (Linux), utiliza siempre 'mkdir -p' para crear carpetas de forma segura sin que fallen si ya existen.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "El comando de bash/powershell/cmd a ejecutar",
      },
      cwd: {
        type: "string",
        description: "El directorio donde se ejecutará el comando. Si lo dejas en blanco, se ejecutará en la raíz del proyecto actual de OpenGravity.",
      }
    },
    required: ["command"],
  },
  execute: async (args: { command: string, cwd?: string }) => {
    try {
      const shellToUse = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
      const options = { 
        cwd: args.cwd || process.cwd(),
        shell: shellToUse
      };
      
      const { stdout, stderr } = await execAsync(args.command, options);
      if (stderr && stderr.trim().length > 0) {
        return `Detalles de salida del log (pueden ser warnings o errores minores):\n${stderr}\n\nSalida estándar:\n${stdout}`;
      }
      return stdout || "El comando se ejecutó de forma exitosa y sin salida de texto.";
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return `Error Crítico (ENOENT): No se encontró el intérprete de comandos o el comando '${args.command}' no existe. En Windows, asegúrate de que el comando sea válido para CMD o PowerShell.`;
      }
      return `Fallo intentando ejecutar el comando de shell: ${error.message}${error.stderr ? '\nDetalle: ' + error.stderr : ''}`;
    }
  }
};
