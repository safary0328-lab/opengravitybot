import axios from "axios";
import { config } from "../config.js";

/**
 * Herramienta de Búsqueda Web para OpenGravity.
 * Utiliza la API de Tavily (diseñada para agentes AI).
 * Si no hay clave, devuelve un mensaje de error detallado.
 */
export const web_search = {
  name: "web_search",
  description: "Search the web for real-time information, news, and complex queries. Use this when you don't know the answer or need up-to-date data.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to look up on the internet."
      }
    },
    required: ["query"]
  },
  execute: async ({ query }: { query: string }) => {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return "Error: TAVILY_API_KEY is missing in environment variables. Please provide it to enable web search.";
    }

    try {
      console.log(`Buscando en la web: ${query}...`);
      
      const response = await axios.post("https://api.tavily.com/search", {
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5
      });

      const results = response.data.results.map((r: any) => 
        `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content}\n`
      ).join("\n---\n");

      return results || "No se encontraron resultados relevantes.";
    } catch (err: any) {
      console.error("Error en la búsqueda web:", err.message);
      return `Error al realizar la búsqueda: ${err.message}`;
    }
  }
};
