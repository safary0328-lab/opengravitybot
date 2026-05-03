import axios from "axios";
import { config } from "./config.js";

/**
 * Convierte texto a audio. Usa ElevenLabs para máxima calidad si la API key está presente,
 * de lo contrario cae en Google Translate TTS (Gratis y Robusto).
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  const cleanText = text
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .replace(/`/g, '')
    .replace(/#/g, '')
    .trim();

  // 1. ElevenLabs TTS (Premium - Voz Bonita y Fluida)
  if (config.ELEVENLABS_API_KEY) {
    try {
      console.log("🎙️ Usando ElevenLabs TTS...");
      const voiceId = "EXAVITQu4vr4xnSDxMaL"; // Sarah/Bella - Voz amigable en español
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
      
      const response = await axios.post(url, {
        text: cleanText,
        model_id: "eleven_multilingual_v2", // V2 es óptimo para Español fluido
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }, {
        headers: {
          "xi-api-key": config.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer"
      });

      return Buffer.from(response.data);
    } catch (err: any) {
      console.error("⚠️ ElevenLabs falló el procesamiento del audio, cayendo a Google TTS:", err.message);
    }
  }

  // 2. Google Translate TTS (Fallback Gratuito)
  try {
    console.log("🤖 Usando Google TTS...");
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
  const keywords = [
    'en voz', 'audio', 'háblame', 'hablame', 'dímelo', 'dimelo', 
    'escuchar', 'voz alta', 'manda un audio', 'mandame un audio', 'mándame un audio',
    'nota de voz', 'cuéntame', 'cuentame', 'reproduce', 'reproducir'
  ];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}
