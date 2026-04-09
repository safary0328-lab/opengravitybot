import { transcribeAudio } from './src/transcribe.js';

async function run() {
  try {
    const res = await fetch('https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg');
    const buffer = Buffer.from(await res.arrayBuffer());
    const result = await transcribeAudio(buffer, 'voice.ogg');
    console.log('Test transcription result:');
    console.log(result);
  } catch (err) {
    console.error('Test Failed:', err);
  }
}
run();
