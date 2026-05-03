import { GoogleGenerativeAI } from "@google/generative-ai";

export const detectar_comida_en_foto = {
  name: "detectar_comida_en_foto",
  description: `Analiza una imagen en Base64 usando IA de visión (Gemini) para detectar los alimentos presentes y devuelve un análisis calórico detallado aproximado. Úsalo cuando el usuario envíe una foto de comida.`,
  parameters: {
    "type": "object",
    "properties": {
      "foto_base64": {
        "type": "string",
        "description": "La imagen codificada en Base64 (sin el prefijo data:image/...)"
      },
      "mime_type": {
        "type": "string",
        "description": "El tipo MIME de la imagen. Ej: 'image/jpeg', 'image/png'. Por defecto 'image/jpeg'."
      }
    },
    "required": ["foto_base64"]
  },
  execute: async (args: { foto_base64: string; mime_type?: string }) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return "Error: GEMINI_API_KEY no configurado. No se puede analizar la imagen.";
      }

      const gemini = new GoogleGenerativeAI(apiKey);
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

      const mimeType = (args.mime_type || "image/jpeg") as any;

      const result = await model.generateContent([
        {
          inlineData: {
            data: args.foto_base64,
            mimeType: mimeType,
          }
        },
        {
          text: `Eres un nutricionista experto. Analiza esta imagen de comida y devuelve un JSON con los alimentos detectados y sus calorías estimadas.
          
Responde ÚNICAMENTE con un JSON válido en este formato:
{
  "alimentos": [
    {"nombre": "nombre del alimento", "cantidad_estimada": "ej: 1 plato grande", "calorias": 350, "proteinas": "20g", "carbohidratos": "40g", "grasas": "10g"}
  ],
  "calorias_totales": 350,
  "resumen": "Descripción breve y amigable del análisis"
}

Si no detectas comida, indica "alimentos": [] y explícalo en "resumen".`
        }
      ]);

      const responseText = result.response.text().trim();
      
      // Intentar parsear y re-formatear de forma bonita
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return `🍽️ **Análisis Nutricional:**\n\n${JSON.stringify(parsed, null, 2)}`;
        }
      } catch (_) {}
      
      return responseText;
    } catch (error: any) {
      return `Error al analizar la imagen con Gemini Vision: ${error.message}`;
    }
  }
};