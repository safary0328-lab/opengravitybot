// Herramienta auto-expandida creada dinámicamente
export const obtener_clima = {
  name: "obtener_clima",
  description: `Obtiene el clima actual`,
  parameters: {"type": "object", "properties": { "ciudad": { "type": "string" } }, "required": ["ciudad"] },
  execute: async ({ ciudad }: { ciudad: string }) => {
    try {
      return `El clima en ${ciudad} es actualmente soleado (simulado).`;
    } catch (error: any) {
      return `Error en obtener_clima: ${error.message}`;
    }
  }
};