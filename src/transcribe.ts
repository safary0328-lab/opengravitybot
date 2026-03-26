import { config } from './config.js';

/**
 * Transcribe un audio usando el modelo Whisper de Groq.
 * Rápido, preciso y gratuito con tu API key.
 */
export async function transcribeAudio(fileBuffer: Buffer, filename: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'audio/ogg' });
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('language', 'es');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error de transcripción Groq: ${response.status} - ${error}`);
  }

  const transcription = await response.text();
  return transcription.trim();
}
