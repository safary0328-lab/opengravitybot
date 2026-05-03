// Herramienta auto-expandida creada dinámicamente
export const procesar_comida_y_calorias = {
  name: "procesar_comida_y_calorias",
  description: `Esta herramienta procesa una imagen de comida (en formato Base64) junto con datos personales (edad, estatura, peso, sexo) para detectar alimentos, analizar su contenido calórico y proporcionar recomendaciones nutricionales. Es útil para aplicaciones de seguimiento de dietas y salud.`,
  parameters: {
  "type": "object",
  "properties": {
    "foto_base64": {
      "type": "string",
      "description": "La imagen de la comida en formato Base64."
    },
    "datos_personales": {
      "type": "object",
      "properties": {
        "edad": {
          "type": "integer",
          "description": "La edad de la persona en años."
        },
        "estatura": {
          "type": "number",
          "description": "La estatura de la persona en centímetros."
        },
        "peso": {
          "type": "number",
          "description": "El peso de la persona en kilogramos."
        },
        "sexo": {
          "type": "string",
          "description": "El sexo de la persona (ej. 'masculino', 'femenino')."
        }
      },
      "required": ["edad", "estatura", "peso", "sexo"]
    }
  },
  "required": ["foto_base64", "datos_personales"]
},
  execute: async (args: any) => {
    try {

async function detectFoodAndCalories(args: { foto_base64: string, datos_personales: { edad: number, estatura: number, peso: number, sexo: string } }): Promise<string> {
    try {
        // Aquí iría la lógica para llamar a la herramienta 'detectar_comida_en_foto'
        // que se asume ya existe y está integrada.
        // La herramienta 'detectar_comida_en_foto' espera 'foto_base64' y 'datos_personales'.
        // Asumimos que la herramienta existente se llama 'analizador_de_comidas'
        // y que el comportamiento es el deseado.
        const result = await global.kernel.runTool('analizador_de_comidas', args);
        return JSON.stringify(result);
    } catch (error) {
        console.error("Error al detectar comida y calorías:", error);
        return JSON.stringify({ error: "No se pudo procesar la imagen o los datos proporcionados." });
    }
}
return detectFoodAndCalories(args);
    
    } catch (error: any) {
      return `Error fallido en la herramienta procesar_comida_y_calorias: ${error.message}`;
    }
  }
};