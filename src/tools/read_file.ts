import fs from "fs";
import path from "path";

export const read_file = {
  name: "read_file",
  description: "Lee el contenido de un archivo en el workspace. Úsalo para revisar código u otros archivos de texto y analizarlos.",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "El path del archivo a leer.",
      }
    },
    required: ["filePath"]
  },
  execute: async ({ filePath }: { filePath: string }) => {
    try {
      const targetPath = path.resolve(process.cwd(), filePath);
      const content = fs.readFileSync(targetPath, "utf-8");
      return content;
    } catch (err: any) {
      return `Error al leer archivo: ${err.message}`;
    }
  }
};
