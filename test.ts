import { transcribeAudio } from './src/transcribe.js';
import fs from 'fs';

async function run() {
  try {
    // We send an empty buffer just to see the HTTP response from Groq
    const emptyBuffer = Buffer.alloc(10);
    const result = await transcribeAudio(emptyBuffer, 'test.ogg');
    console.log('Result:', result);
  } catch (err) {
    console.error('Test Failed:', err);
  }
}
run();
