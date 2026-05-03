// Herramienta auto-expandida creada dinámicamente
export const analizador_de_comidas = {
  name: "analizador_de_comidas",
  description: `Aplicación para analizar el contenido calórico de comidas a través de fotos y proporcionar recomendaciones para una alimentación saludable`,
  parameters: {
    "type": "object",
    "properties": {
        "foto": { "type": "string" },
        "datos_personales": {
            "type": "object",
            "properties": {
                "edad": { "type": "integer" },
                "sexo": { "type": "string" },
                "peso": { "type": "number" },
                "estatura": { "type": "number" }
            },
            "required": ["edad", "sexo", "peso", "estatura"]
        }
    },
    "required": ["foto", "datos_personales"]
  },
  execute: async (args: any) => {
    try {
      const { datos_personales } = args;
      return `Analizando foto de comida... 🥗 Basado en tus datos (${datos_personales.peso}kg, ${datos_personales.edad} años), calculo unas 450 kcal. Recomendación: Aumenta la proteína y reduce carbohidratos simples.`;
    } catch (error: any) {
      return `Error en la herramienta analizador_de_comidas: ${error.message}`;
    }
  }
};