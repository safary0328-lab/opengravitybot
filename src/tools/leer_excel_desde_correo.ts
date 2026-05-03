import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

export const leer_excel_desde_correo = {
  name: "leer_excel_desde_correo",
  description: "Busca en Gmail el correo más reciente que coincida con una palabra clave (ej: nombre de persona), extrae automáticamente el enlace de Google Sheets que contenga, y lee la tabla de pagos. Ideal para simplificar procesos complejos para el usuario.",
  parameters: {
    type: "object",
    properties: {
      palabra_clave: {
        type: "string",
        description: "Palabra clave para buscar el correo en Gmail (Ej: 'Francia', 'Cris'). No uses fechas estrictas para no fallar.",
      },
      nombre_hoja: {
        type: "string",
        description: "Opcional. Nombre de la pestaña u hoja específica a leer (Ej: 'Hoja 2'). Si no se envía, lee la primera hoja por defecto.",
      },
      con_formulas: {
        type: "boolean",
        description: "Opcional. Si es true, lee las fórmulas de las celdas en lugar de los valores calculados. Útil para encontrar errores matemáticos.",
      }
    },
    required: ["palabra_clave"],
  },
  execute: async (args: { palabra_clave: string, nombre_hoja?: string, con_formulas?: boolean }) => {
    try {
      const executableName = process.platform === 'win32' ? 'gog.exe' : 'gog';
      const executablePath = path.join(rootDir, executableName);
      
      let runOptions: any = {};
      const envCopy = Object.assign({}, process.env);
      if (process.env.GOG_AUTH_JSON) {
        envCopy.GOG_KEYRING_BACKEND = "file";
        envCopy.GOG_KEYRING_PASSWORD = "opengravity_default_password";
        const localConfigDir = path.join(rootDir, ".gog_config");
        envCopy.XDG_CONFIG_HOME = localConfigDir;
        envCopy.HOME = rootDir; 
      }
      runOptions.env = envCopy;
      runOptions.shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
      runOptions.cwd = rootDir;

      // Paso 1: Buscar en Gmail
      const searchCmd = `"${executablePath}" gmail search "${args.palabra_clave}" --json`;
      const { stdout: searchOut } = await execAsync(searchCmd, runOptions);
      
      const searchResult = JSON.parse(searchOut.toString());
      if (!searchResult.threads || searchResult.threads.length === 0) {
        return `No se encontraron correos con la palabra clave: ${args.palabra_clave}`;
      }

      // Tomamos el primer hilo (más reciente)
      const threadId = searchResult.threads[0].id;

      // Paso 2: Leer el correo para extraer el ID de la hoja
      const readCmd = `"${executablePath}" gmail read ${threadId} --plain`;
      const { stdout: readOut } = await execAsync(readCmd, runOptions);
      const readOutStr = readOut.toString();

      // Buscamos algo como: https://docs.google.com/spreadsheets/d/ID_AQUI/
      const match = readOutStr.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        return `Se encontró el correo (${searchResult.threads[0].subject}), pero no contiene ningún enlace a una hoja de cálculo (Google Sheets).`;
      }

      const sheetId = match[1];

      // Paso 3: Leer la hoja de cálculo
      const range = args.nombre_hoja ? `'${args.nombre_hoja}'!A1:Z100` : `A1:Z100`;
      const renderFlag = args.con_formulas ? `--render=FORMULA` : ``;
      const sheetCmd = `"${executablePath}" sheets read ${sheetId} "${range}" ${renderFlag} --json`;
      const { stdout: sheetOut } = await execAsync(sheetCmd, runOptions);
      
      const sheetData = JSON.parse(sheetOut.toString());
      
      return `¡Éxito! Encontré el correo: "${searchResult.threads[0].subject}".\nExtraje el archivo Excel de la ${args.nombre_hoja ? args.nombre_hoja : 'Hoja 1'} y estos son los datos:\n${JSON.stringify(sheetData.values, null, 2)}`;

    } catch (error: any) {
      return `Fallo al procesar automáticamente el Excel desde el correo: ${error.message}`;
    }
  }
};
