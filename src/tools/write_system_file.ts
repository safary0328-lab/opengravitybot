import fs from "fs";
import path from "path";

export const write_system_file = {
  name: "write_system_file",
  description: "Crea o sobrescribe por completo un archivo de programación/texto en el disco duro del usuario. Úsalo estrictamente para guardar código HTML, Javascript, CSS, Python, o cualquier otra cosa que el usuario exprese que le diseñes, o cuando debas modificar la base de una app construida. Genera todos los directorios automáticamente si no existen.",
  parameters: {
    type: "object",
    properties: {
      absolute_path: {
        type: "string",
        description: "Ruta absoluta donde se desea escribir (Ej: C:\\Users\\safar\\Desktop\\Calculadora\\index.html) o ruta relativa a OpenGravity (Ej: mis_apps/index.js).",
      },
      file_content: {
        type: "string",
        description: "El código fuente completo y terminado para ese archivo. Hazlo de altísima calidad y con formato limpio.",
      }
    },
    required: ["absolute_path", "file_content"],
  },
  execute: async (args: { absolute_path: string, file_content: string }) => {
    try {
      const targetPath = path.resolve(process.cwd(), args.absolute_path);
      const dir = path.dirname(targetPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(targetPath, args.file_content, "utf8");
      
      return `¡Super éxito! El archivo final (tamaño: ${args.file_content.length} caracteres) fue volcado y guardado en:\n${targetPath}`;
    } catch (error: any) {
      return `Fallo intentando escribir este archivo a nivel de sistema operativo: ${error.message}`;
    }
  }
};
