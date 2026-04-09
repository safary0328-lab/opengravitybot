import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export const google_workspace_gog = {
  name: "google_workspace_gog",
  description: "Ejecuta comandos CLI con 'gog' para acceder a Gmail, Calendar, Drive, Sheets y Docs del usuario. Debes escribir el comando exacto (ej. 'gog gmail search \"newer_than:1d\"' o 'gog calendar events primary'). SIEMPRE usa --json si el comando lo soporta. Si el comando falla por falta de credenciales, indícalo al usuario. El bot en la nube usa el archivo .gog_auth.json para persistir el acceso.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "El comando de 'gog' completo a ejecutar. Debe empezar por 'gog '",
      },
    },
    required: ["command"],
  },
  execute: async (args: { command: string }) => {
    try {
      if (!args.command.startsWith("gog ")) {
        return "Error: El comando debe empezar con 'gog '";
      }

      const executable = process.platform === 'win32' ? '.\\gog.exe' : 'gog';
      let commandToRun = args.command.replace(/^gog\s+/, `${executable} `);
      if (!commandToRun.includes("--no-input")) {
        commandToRun += " --no-input";
      }
      let runOptions: any = {};

      // Si existe GOG_AUTH_JSON en el entorno (ej: HuggingFace),
      // forzamos a gog a usar el backend 'file' estándar para que use el archivo en lugar de llaveros de SO.
      if (process.env.GOG_AUTH_JSON) {
        const authPath = path.resolve("./.gog_auth.json");
        const envCopy = Object.assign({}, process.env);
        envCopy.GOG_KEYRING_BACKEND = "file";
        runOptions.env = envCopy;

        if (!fs.existsSync(authPath)) {
          console.log("📝 Restaurando credenciales GOG desde variable de entorno al keyring...");
          fs.writeFileSync(authPath, process.env.GOG_AUTH_JSON);
          // Importamos el token hacia el gestor de "file" nativo de 'gog'
          try {
            await execAsync(`"${executable}" auth tokens import "${authPath}"`, { env: envCopy });
            console.log("✅ Token GOG importado en el keyring correctamente.");
          } catch (importErr) {
            console.error("⚠️ Error importando token:", importErr);
          }
        }
      }

      const { stdout, stderr } = await execAsync(commandToRun, runOptions);
      
      const stderrStr = stderr ? stderr.toString() : "";
      const stdoutStr = stdout ? stdout.toString() : "";

      if (stderrStr && stderrStr.toLowerCase().includes("error") && !stdoutStr) {
        return `Error en la ejecución: ${stderrStr}\n\nSi el error es de autenticación, por favor configura el archivo .gog_auth.json con tus tokens.`;
      }
      
      return stdoutStr || (stderrStr ? `Aviso: ${stderrStr}` : "El comando finalizó con éxito pero no devolvió salida.");
    } catch (error: any) {
      const errStr = error.stderr ? error.stderr.toString() : "";
      if (errStr && errStr.includes("login")) {
        return `Error de autenticación: El bot no tiene acceso a tu cuenta de Google. Avisa al usuario que debe configurar el acceso. Detalle: ${errStr}`;
      }
      return `Fallo catastrófico al ejecutar gog: ${error.message}${errStr ? "\nDetalle: " + errStr : ""}`;
    }
  },
};

