import { textToSpeech } from './src/tts.js';
import fs from 'fs';

async function run() {
  try {
    const buffer = await textToSpeech('Hola, soy tu asistente de Open Gravity. Esta es una prueba de voz.');
    fs.writeFileSync('test_tts.mp3', buffer);
    console.log('✅ ElevenLabs TTS funcionó correctamente y guardó test_tts.mp3');
  } catch (err) {
    console.error('❌ Error de ElevenLabs:', err);
  }
}
run();
