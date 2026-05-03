/**
 * Herramienta para que el agente pueda responder explícitamente con voz.
 */
export const voice_response = {
  name: "voice_response",
  description: "Responde al usuario con un mensaje de voz (audio) en lugar de texto. Úsalo cuando el usuario te pida explícitamente un audio, que le hables, o cuando quieras dar una respuesta más personal y premium.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "El contenido textual que será convertido a voz y enviado como audio."
      }
    },
    required: ["text"]
  },
  execute: async ({ text }: { text: string }) => {
    // Retornamos un marcador especial que el bot interceptará en bot.ts
    // Esto evita tener que manejar buffers aquí y mantiene la lógica de TTS centralizada en el bot
    return `[[VOICE_REPLY]]${text}`;
  }
};
