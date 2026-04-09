import axios from "axios";

/**
 * Convierte texto a audio usando la API de Google Translate TTS (Gratis y Robusto).
 * No requiere librerías externas ni API Keys.
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  // Limpiar texto de carácteres que confunden al TTS
  const cleanText = text
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .replace(/`/g, '')
    .replace(/#/g, '')
    .trim();

  try {
    // Google TTS tiene un límite de 200 caracteres por petición.
    // Dividimos el texto en trozos seguros.
    const chunks = splitText(cleanText, 200);
    const audioBuffers: Buffer[] = [];

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=es&client=tw-ob`;
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      audioBuffers.push(Buffer.from(response.data));
    }

    return Buffer.concat(audioBuffers);
  } catch (err: any) {
    console.error("Google TTS Error:", err.message);
    throw new Error(`Error en el motor de voz: ${err.message}`);
  }
}

/**
 * Divide un texto en trozos de un tamaño máximo sin cortar palabras.
 */
function splitText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  
  // Dividir por espacios y saltos de línea
  const words = text.split(/[\s\n]+/);
  let currentChunk = "";

  for (let word of words) {
    if (!word) continue;

    // Si una sola palabra es más grande que el límite, forzamos su corte
    while (word.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      chunks.push(word.substring(0, maxLength));
      word = word.substring(maxLength);
    }

    if (!word) continue;

    if ((currentChunk + (currentChunk ? " " : "") + word).length <= maxLength) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/**
 * Detecta si el usuario pide voz.
 */
export function isVoiceRequest(text: string): boolean {
  const keywords = ['en voz', 'audio', 'háblame', 'hablame', 'dímelo', 'dimelo', 'escuchar', 'voz alta', 'manda un audio'];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}
