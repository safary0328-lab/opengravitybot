import { get_current_time } from "./get_current_time.js";
import { web_search } from "./web_search.js";

/**
 * Registro de herramientas disponibles para el Agente OpenGravity.
 */
export const tools = {
  get_current_time,
  web_search
};

export type ToolName = keyof typeof tools;

/**
 * Definiciones de herramientas formateadas para el modelo de lenguaje (LLM).
 */
export const toolDefinitions = Object.values(tools).map(t => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }
}));
