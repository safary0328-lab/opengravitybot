// Herramienta auto-expandida creada dinámicamente
export const obtener_clima = {
  name: "obtener_clima",
  description: `Obtiene el clima actual`,
  parameters: {"type": "object", "properties": { "ciudad": { "type": "string" } }, "required": ["ciudad"] },
  execute: async (args: any) => {
    try {
function obtenerClima(ciudad) { return "El clima en " + ciudad + " es soleado"; }
    } catch (error: any) {
      return `Error fallido en la herramienta obtener_clima: ${error.message}`;
    }
  }
};