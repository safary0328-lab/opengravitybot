import fs from "fs";
import path from "path";

export const create_agent_tool = {
  name: "create_agent_tool",
  description: "Escribe, compila y auto-conecta una nueva herramienta de código (skill) para que te vuelvas más inteligente en tiempo real. Utilízala cuando el usuario te pida construir un nuevo comando, herramienta o conectarte a un API que no poseas. Puedes escribir código NodeJS que haga llamadas HTTP, use filesystem, etc.",
  parameters: {
    type: "object",
    properties: {
      tool_name: {
        type: "string",
        description: "Nombre de tu nueva herramienta, todo en minúsculas y con guiones bajos (ej: obtener_clima).",
      },
      tool_description: {
        type: "string",
        description: "Descripción detallada de para qué sirve tu nueva herramienta y cómo debes usarla en el futuro.",
      },
      tool_parameters_json_schema: {
        type: "string",
        description: "El objeto JSON Schema en string con los parámetros de la herramienta. Ej: '{ \"type\": \"object\", \"properties\": { \"ciudad\": { \"type\": \"string\" } }, \"required\": [\"ciudad\"] }'",
      },
      tool_code_body: {
        type: "string",
        description: "El código interno TypeScript de la función que programarás. OJO: El código estará dentro de un bloque try/catch en una función async que recibe 'args: any'. Retorna siempre un string.",
      }
    },
    required: ["tool_name", "tool_description", "tool_parameters_json_schema", "tool_code_body"],
  },
  execute: async (args: { tool_name: string; tool_description: string; tool_parameters_json_schema: string; tool_code_body: string }) => {
    try {
      const toolsDir = path.resolve(process.cwd(), "src", "tools");
      const toolFilePath = path.join(toolsDir, `${args.tool_name}.ts`);
      const indexFilePath = path.join(toolsDir, "index.ts");

      if (fs.existsSync(toolFilePath)) {
        return `Error: Una herramienta llamada '${args.tool_name}' ya existe.`;
      }

      const safeDescription = args.tool_description.replace(/`/g, '\\`');

      const fileContent = `// Herramienta auto-expandida creada dinámicamente
export const ${args.tool_name} = {
  name: "${args.tool_name}",
  description: \`${safeDescription}\`,
  parameters: ${args.tool_parameters_json_schema},
  execute: async (args: any) => {
    try {
${args.tool_code_body}
    } catch (error: any) {
      return \`Error fallido en la herramienta ${args.tool_name}: \${error.message}\`;
    }
  }
};
`;

      fs.writeFileSync(toolFilePath, fileContent.trim());

      let indexContent = fs.readFileSync(indexFilePath, "utf8");
      const importStatement = `import { ${args.tool_name} } from "./${args.tool_name}.js";\n`;

      if (!indexContent.includes(args.tool_name)) {
        indexContent = importStatement + indexContent;
        indexContent = indexContent.replace(
          /export const tools = {([\s\S]*?)};/,
          (match, p1) => {
            const trimmed = p1.trimEnd();
            const comma = trimmed.endsWith(",") ? "" : ",";
            return `export const tools = {${p1}${comma}\n  ${args.tool_name}\n};`;
          }
        );

        // Guardamos el índice con un timeout de 3 segundos
        // Esto le da tiempo al bot de responder al humano por Telegram ANTES de que \`tsx watch\` mate el proceso
        setTimeout(() => {
          fs.writeFileSync(indexFilePath, indexContent);
        }, 3000);

        return "¡ÉXITO! Tu nueva herramienta fue compilada e inyectada. El sistema se reiniciará en 3 segundos. Avisa al humano que su nueva herramienta se ha conectado existosamente y está lista.";
      } else {
        return "Advertencia: Registrado en index.ts pero ya existía.";
      }
    } catch (error: any) {
      return `Fallo creando la herramienta: ${error.message}`;
    }
  }
};
