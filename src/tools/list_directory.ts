import fs from "fs";
import path from "path";

export const list_directory = {
  name: "list_directory",
  description: "Lista los archivos y carpetas dentro de un directorio del workspace. Úsalo para explorar el proyecto y saber qué archivos existen.",
  parameters: {
    type: "object",
    properties: {
      dirPath: {
        type: "string",
        description: "El path del directorio a explorar. Usa '.' para el directorio actual.",
      }
    },
    required: ["dirPath"]
  },
  execute: async ({ dirPath }: { dirPath: string }) => {
    try {
      const targetPath = path.resolve(process.cwd(), dirPath);
      const files = fs.readdirSync(targetPath, { withFileTypes: true });
      const output = files.map(f => `${f.isDirectory() ? '[DIR]' : '[FILE]'} ${f.name}`).join("\n");
      return `Contenido de ${targetPath}:\n${output || "(Directorio vacío)"}`;
    } catch (err: any) {
      return `Error al leer directorio: ${err.message}`;
    }
  }
};
