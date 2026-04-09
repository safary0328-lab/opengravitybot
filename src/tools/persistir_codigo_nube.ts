import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const persistir_codigo_nube = {
  name: "persistir_codigo_nube",
  description: "Guarda la memoria, el código y las nuevas herramientas creadas de forma INMORTAL Y PERMANENTE subiéndolas a tu repositorio git en la Nube (Git Commit & Push). Debes usar esta herramienta SIEMPRE después de usar 'create_agent_tool' para asegurar tu supervivencia si el servidor se reinicia.",
  parameters: {
    type: "object",
    properties: {
      mensaje_commit: {
        type: "string",
        description: "Mensaje corto describiendo tu evolución (Ej: 'Auto-Evolución: Creada nueva herramienta para calcular criptos').",
      }
    },
    required: ["mensaje_commit"],
  },
  execute: async (args: { mensaje_commit: string }) => {
    try {
      // Definimos opciones de ejecución robustas
      const shellToUse = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
      const runOptions = { shell: shellToUse, cwd: process.cwd() };

      // Configuramos identidad git interna por si el servidor base no la tiene
      await execAsync('git config --global user.email "agente@vibranium.com" || true', runOptions);
      await execAsync('git config --global user.name "Agente OpenGravity" || true', runOptions);

      await execAsync("git add .", runOptions);
      const { stdout: status } = await execAsync("git status --porcelain", runOptions);
      
      if (!status.trim()) {
        return "El escáner de memoria indica que no hay ningún cambio en tu ADN de código para respaldar. Saltando compresión.";
      }

      const safeMessage = args.mensaje_commit.replace(/"/g, '\\"');
      await execAsync(`git commit -m "${safeMessage}"`, runOptions);

      // Intentamos subirlo a 'hf' o 'origin' o al predeterminado.
      let salidaPush = "";
      try {
        // En HF a veces es hf, en github es origin
        const { stdout, stderr } = await execAsync("git push hf main || git push origin main || git push", runOptions);
        salidaPush = stdout + "\\n" + stderr;
      } catch (pushError: any) {
        return `⚠️ Logré compilar tu auto-guardado local (git commit completado), PERO la Nube denegó la sincronización Final (git push falló): ${pushError.message}. Avísale al humano que le faltan credenciales Git en el Docker de Hugging Face.`;
      }

      return `¡RESONANCIA LOGRADA! Tu memoria ha sido inmortalizada y empaquetada en la infraestructura principal mundial exitosamente.\\nSalida Git:\\n${salidaPush}`;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
         return `Error Crítico (ENOENT): El ejecutable 'git' no se encontró en el sistema. Asegúrate de tener Git instalado y en el PATH.`;
      }
      return `Fallo catastrófico intentando hacer el respaldo en Github/HuggingFace: ${error.message}`;
    }
  }
};
