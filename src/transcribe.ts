import { config } from './config.js';
import Groq, { toFile } from 'groq-sdk';
import { spawn } from 'child_process';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

/**
 * Transcribe un audio usando el modelo Whisper de Groq.
 * Si falla (ej. rate limit), intenta usar Google Gemini como fallback.
 */
export async function transcribeAudio(fileBuffer: Buffer, filename: string): Promise<string> {
  let finalBuffer = fileBuffer;
  let finalFilename = filename;

  // Si es un audio de Telegram (.ogg), intentamos convertirlo a MP3 para Groq/Gemini
  if (filename.endsWith('.ogg')) {
    console.log("🛠️ Intentando convertir OGG a MP3 de forma asíncrona...");
    try {
      finalBuffer = await new Promise((resolve, reject) => {
        const ffmpegPath = process.platform === 'win32' ? ffmpegInstaller.path : 'ffmpeg';
        const ffmpeg = spawn(ffmpegPath, [
          '-i', 'pipe:0',      // Entrada desde stdin
          '-f', 'mp3',         // Formato de salida MP3
          '-acodec', 'libmp3lame',
          '-ab', '128k',
          '-ar', '44100',
          'pipe:1'             // Salida a stdout
        ], { 
          shell: false 
        });

        const chunks: Buffer[] = [];
        ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve(Buffer.concat(chunks));
          } else {
            reject(new Error(`FFmpeg falló con código ${code}`));
          }
        });

        ffmpeg.on('error', (err) => reject(err));

        ffmpeg.stdin.write(fileBuffer);
        ffmpeg.stdin.end();
      });
      finalFilename = filename.replace('.ogg', '.mp3');
    } catch (err: any) {
      console.warn("⚠️ Falló conversión FFmpeg, se usará buffer original:", err.message);
    }
  }

  const extension = finalFilename.split('.').pop();
  const mimeType = extension === 'mp3' ? 'audio/mpeg' : (extension === 'ogg' ? 'audio/ogg' : 'application/octet-stream');

  // 1️⃣ Intento con Groq (Whisper)
  try {
    console.log(`📡 Transcribiendo con Groq (Whisper)...`);
    const file = await toFile(finalBuffer, finalFilename, { type: mimeType });
    const response = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3-turbo',
      language: 'es',
    });
    return response.text.trim();
  } catch (groqErr: any) {
    console.error("❌ Falló Groq Whisper:", groqErr.message);

    // 2️⃣ Fallback a Gemini (Multimodal)
    const geminiModels = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b", "gemini-2.0-flash-exp"];
    for (const modelName of geminiModels) {
      try {
        console.log(`🛠️ Intento fallback transcripción con ${modelName}...`);
        if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no configurado.");

        const gemini = new GoogleGenerativeAI(config.GEMINI_API_KEY);
        const model = gemini.getGenerativeModel({ model: modelName });

        const result = await model.generateContent([
          {
            inlineData: {
              data: finalBuffer.toString("base64"),
              mimeType: mimeType === 'application/octet-stream' ? 'audio/mpeg' : mimeType
            }
          },
          { text: "Transcribe este audio. Responde SOLO con el texto transcrito." },
        ]);

        const transcription = result.response.text().trim();
        console.log(`✅ Transcripción exitosa con ${modelName}.`);
        return transcription;
      } catch (geminiErr: any) {
        console.error(`❌ Falló ${modelName}:`, geminiErr.message);
      }
    }
    throw new Error("No se pudo transcribir el audio (Groq y Gemini fallaron en cascada).");
  }
}


