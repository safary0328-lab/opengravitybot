import { Bot, InputFile } from "grammy";
import { config } from "./config.js";
import { runAgent } from "./agent.js";
import { transcribeAudio } from "./transcribe.js";
import { textToSpeech, isVoiceRequest } from "./tts.js";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import http from "http";

// --- EMERGENCY BYPASS (Temporal para diagnóstico final) ---
const BYPASS_SECURITY = true; 
// ---------------------------------------------------------

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'x-application-name': 'opengravity' } }
});

const cloudLogs: string[] = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  cloudLogs.push(`[LOG] ${args.join(" ")}`);
  if (cloudLogs.length > 50) cloudLogs.shift();
  originalLog(...args);
};
console.error = (...args) => {
  cloudLogs.push(`[ERROR] ${args.join(" ")}`);
  if (cloudLogs.length > 50) cloudLogs.shift();
  originalError(...args);
};

async function convertToVoice(mp3Buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve) => {
    const ffmpegPath = process.platform === 'win32' ? ffmpegInstaller.path : 'ffmpeg';
    const ffmpeg = spawn(ffmpegPath, [
      '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-compression_level', '10', '-f', 'opus', 'pipe:1'
    ]);
    const chunks: Buffer[] = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.on('close', (code) => resolve(code === 0 ? Buffer.concat(chunks) : mp3Buffer));
    ffmpeg.on('error', () => resolve(mp3Buffer));
    ffmpeg.stdin.write(mp3Buffer);
    ffmpeg.stdin.end();
  });
}

async function handleAgentResponse(ctx: any, response: string, transcription?: string) {
  if (response.includes("[[VOICE_REPLY]]") || isVoiceRequest(response)) {
    const textToSpeak = response.replace("[[VOICE_REPLY]]", "").trim();
    try {
      const mp3Buffer = await textToSpeech(textToSpeak);
      const voiceBuffer = await convertToVoice(mp3Buffer);
      await ctx.replyWithVoice(new InputFile(voiceBuffer, "voice.ogg"), {
        caption: transcription ? `🎤 "${transcription}"` : undefined
      });
    } catch (e) {
      await ctx.reply(textToSpeak);
    }
  } else {
    await ctx.reply((transcription ? `🎤 "${transcription}"\n\n` : "") + response);
  }
}

bot.command("start", (ctx) => ctx.reply("¡Bot Online! El bypass de seguridad está activo para pruebas."));

bot.on("message", async (ctx) => {
  const userId = ctx.from?.id;
  if (!BYPASS_SECURITY && (!userId || !config.TELEGRAM_ALLOWED_USER_IDS.includes(userId))) {
    return ctx.reply("Acceso denegado.");
  }

  const text = ctx.message.text || "";
  if (ctx.message.voice) {
    try {
      const file = await ctx.api.getFile(ctx.message.voice.file_id);
      const res = await axios.get(`https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`, { responseType: 'arraybuffer' });
      const transcription = await transcribeAudio(Buffer.from(res.data), "voice.ogg");
      const response = await runAgent(ctx.from.id, transcription || "");
      await handleAgentResponse(ctx, response, transcription);
    } catch (e) { console.error(e); }
  } else {
    const response = await runAgent(ctx.from.id, text);
    await handleAgentResponse(ctx, response);
  }
});

bot.start({ drop_pending_updates: true });

const PORT = process.env.PORT || 7860;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.write(`<h1>OpenGravity Status: Online (BYPASS ACTIVE) 🤖</h1>`);
  res.write(`<pre>${cloudLogs.reverse().join("\n")}</pre>`);
  res.end();
}).listen(PORT, '0.0.0.0');
