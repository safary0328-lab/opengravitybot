import { config } from './config.js';
import Groq, { toFile } from 'groq-sdk';
import { spawnSync } from 'child_process';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

/**
 * Transcribe un audio usando el modelo Whisper de Groq.
 * Ahora usa FFmpeg para convertir el buffer original (normalmente OGG/Opus de Telegram)
 * a MP3 antes de enviarlo, asegurando compatibilidad total.
 */
export async function transcribeAudio(fileBuffer: Buffer, filename: string): Promise<string> {
  let finalBuffer = fileBuffer;
  let finalFilename = filename;

  // Si es un audio de Telegram (.ogg), intentamos convertirlo a MP3 usando FFmpeg
  if (filename.endsWith('.ogg')) {
    console.log("🛠️ Intentando convertir OGG a MP3 para Groq...");
    try {
      // Verificamos si ffmpeg está disponible antes de llamar
      const checkFfmpeg = spawnSync('ffmpeg', ['-version']);
      
      if (checkFfmpeg.error) {
        console.warn("⚠️ FFmpeg no encontrado en el sistema. Enviando buffer original a Groq...");
      } else {
        const conversion = spawnSync('ffmpeg', [
          '-i', 'pipe:0',      // Entrada desde stdin (buffer)
          '-f', 'mp3',         // Formato de salida MP3
          '-acodec', 'libmp3lame',
          '-ab', '128k',       // Calidad decente para voz
          'pipe:1'             // Salida a stdout
        ], { input: fileBuffer, maxBuffer: 10 * 1024 * 1024 });
  
        if (conversion.status === 0) {
          finalBuffer = conversion.stdout;
          finalFilename = filename.replace('.ogg', '.mp3');
          console.log("✅ Conversión exitosa con FFmpeg.");
        } else {
          console.warn("⚠️ Falló la conversión con FFmpeg (status !== 0), usando buffer original.", conversion.stderr?.toString());
        }
      }
    } catch (err) {
      console.error("❌ Error inesperado ejecutando FFmpeg:", err);
    }
  }

  // Preparamos el archivo para Groq
  const extension = finalFilename.split('.').pop();
  const mimeType = extension === 'mp3' ? 'audio/mpeg' : (extension === 'ogg' ? 'audio/ogg' : 'application/octet-stream');
  
  console.log(`📡 Enviando audio a Groq (Archivo: ${finalFilename}, Mime: ${mimeType}, Size: ${finalBuffer.length} bytes)...`);

  try {
    const file = await toFile(finalBuffer, finalFilename, { type: mimeType });
  
    const response = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3-turbo',
      language: 'es',
    });
  
    return response.text.trim();
  } catch (groqErr: any) {
    console.error("❌ Error de transcripción Groq:", groqErr.message);
    if (groqErr.message.includes("valid media file")) {
       throw new Error("El archivo de audio no es compatible con el motor de transcripción actual (Groq). Prueba enviando un mensaje más corto o de mejor calidad.");
    }
    throw groqErr;
  }
}


