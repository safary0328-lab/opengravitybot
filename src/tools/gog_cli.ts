import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

export const google_workspace_gog = {
  name: "google_workspace_gog",
  description: "Ejecuta comandos CLI con 'gog' para acceder a todo Google Workspace. TIENES PODER TOTAL sin restricciones para: enviar/eliminar correos (gog gmail send/delete), buscar en Drive (gog drive search), editar documentos (gog docs edit/insert/write), y modificar hojas de cálculo (gog sheets update/append/clear). SIEMPRE usa --json si está disponible.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "El comando de 'gog' completo a ejecutar. Ej: 'gog gmail search \"spam\" --json' o 'gog gmail trash \"<ID>\"'",
      },
    },
    required: ["command"],
  },
  execute: async (args: { command: string }) => {
    try {
      if (!args.command.startsWith("gog ")) {
        return "Error: El comando debe empezar con 'gog '";
      }

      const executableName = process.platform === 'win32' ? 'gog.exe' : 'gog';
      let executablePath = path.join(rootDir, executableName);
      
      // Si no existe en el root (caso Docker/Cloud), buscamos en el PATH del sistema
      if (!fs.existsSync(executablePath)) {
        executablePath = executableName;
      }
      
      let accountEmail = "";
      
      let runOptions: any = {};
      const envCopy = Object.assign({}, process.env);
      
      // Si existe GOG_AUTH_JSON en el entorno (ej: HuggingFace),
      // forzamos la sincronización del token, el directorio local y el keyring en archivo.
      if (process.env.GOG_AUTH_JSON) {
        envCopy.GOG_KEYRING_BACKEND = "file";
        envCopy.GOG_KEYRING_PASSWORD = "opengravity_default_password";

        const localConfigDir = path.join(rootDir, ".gog_config");
        if (!fs.existsSync(localConfigDir)) fs.mkdirSync(localConfigDir, { recursive: true });
        envCopy.XDG_CONFIG_HOME = localConfigDir;
        envCopy.HOME = rootDir; 
        
        const authPath = path.join(rootDir, ".gog_auth.json");
        try {
          const authData = JSON.parse(process.env.GOG_AUTH_JSON);
          if (authData.email) {
            accountEmail = authData.email;
            envCopy.GOG_ACCOUNT = accountEmail;
          }
        } catch (e) {}

        fs.writeFileSync(authPath, process.env.GOG_AUTH_JSON);
        // Aseguramos que el token esté importado antes de seguir
        try {
          await execAsync(`"${executablePath}" auth tokens import "${authPath}"`, { env: envCopy });
        } catch (importErr) {
          // Si falla la importación, lo reportamos pero intentamos seguir
        }
      }

      runOptions.env = envCopy;
      runOptions.shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
      runOptions.cwd = rootDir;

      // Construcción del comando final con inyección de cuenta para evitar error "missing account"
      let commandToRun = args.command.replace(/^gog\s+/, `"${executablePath}" `);
      if (accountEmail && !commandToRun.includes("--account") && !commandToRun.includes(" -a ")) {
        commandToRun += ` --account ${accountEmail}`;
      }
      if (!commandToRun.includes("--no-input")) {
        commandToRun += " --no-input";
      }

      const { stdout, stderr } = await execAsync(commandToRun, runOptions);
      
      const stderrStr = stderr ? stderr.toString() : "";
      const stdoutStr = stdout ? stdout.toString() : "";

      console.log(`[GOG] Command: ${commandToRun}`);
      console.log(`[GOG] Stdout: ${stdoutStr.substring(0, 100)}...`);
      console.log(`[GOG] Stderr: ${stderrStr.substring(0, 100)}...`);

      if (stderrStr && (stderrStr.toLowerCase().includes("error") || stderrStr.includes("failed")) && !stdoutStr) {
        return `Error en la ejecución de gog:\n${stderrStr}`;
      }
      
      return stdoutStr || stderrStr || "El comando se ejecutó sin salida.";
    } catch (error: any) {
      const errStr = error.stderr ? error.stderr.toString() : "";
      if (errStr && (errStr.includes("login") || errStr.includes("invalid_grant"))) {
        return `Error de autenticación: El bot no tiene acceso a tu cuenta de Google o el token expiró. 
Avisa al usuario que debe re-autenticarse ejecutando: 'gog login <email> --force-consent'.
Detalle: ${errStr}`;
      }
      return `Fallo catastrófico al ejecutar gog: ${error.message}${errStr ? "\nDetalle: " + errStr : ""}`;
    }
  },
};

