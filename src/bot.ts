import { Bot, InputFile } from "grammy";
import { config } from "./config.js";
import { runAgent } from "./agent.js";
import { transcribeAudio } from "./transcribe.js";
import { textToSpeech, isVoiceRequest } from "./tts.js";
import { spawnSync } from "child_process";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

/**
 * Convierte un buffer MP3 a OGG Opus para Telegram usando FFmpeg.
 */
function convertToVoice(mp3Buffer: Buffer): Buffer {
  try {
    const conversion = spawnSync('ffmpeg', [
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-vbr', 'on',
      '-compression_level', '10',
      '-f', 'opus',
      'pipe:1'
    ], { 
      input: mp3Buffer, 
      maxBuffer: 10 * 1024 * 1024,
      shell: true // Necesario en Windows para resolver ejecutables/scripts
    });

    if (conversion.error) {
      if ((conversion.error as any).code === 'ENOENT') {
        console.error("❌ Error: FFmpeg no está instalado en el sistema. Los mensajes de voz no se enviarán como OGG Opus.");
      } else {
        console.error("❌ Error inesperado ejecutando FFmpeg:", conversion.error.message);
      }
      return mp3Buffer;
    }

    if (conversion.status === 0) {
      console.log("✅ Conversión a OGG exitosa.");
      return conversion.stdout;
    }
    console.error("❌ FFmpeg falló en conversión de salida:", conversion.stderr?.toString());
  } catch (err: any) {
    console.error("❌ Error al convertir a voz:", err.message);
  }
  return mp3Buffer; // Fallback a MP3 si falla
}

// Helper: Escape MarkdownV2 characters
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Helper: Safe reply with Markdown fallback
async function safeReply(ctx: any, text: string, parseMode: "Markdown" | "MarkdownV2" | null = "MarkdownV2") {
  try {
    if (parseMode === "MarkdownV2") {
      await ctx.reply(text, { parse_mode: "MarkdownV2" });
    } else if (parseMode === "Markdown") {
       await ctx.reply(text, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(text);
    }
  } catch (err: any) {
    console.warn(`⚠️ Telegram falló con ${parseMode}: ${err.message}. Reintentando texto plano...`);
    // If Markdown fails, retry with plain text
    try {
      await ctx.reply(text);
    } catch (finalErr: any) {
      console.error("❌ Fallo crítico al enviar mensaje:", finalErr.message);
    }
  }
}

/**
 * Procesa la respuesta del agente y decide si enviarla como texto o voz.
 */
async function handleAgentResponse(ctx: any, response: string, transcription?: string) {
  if (response.startsWith("[[VOICE_REPLY]]") || isVoiceRequest(response) || (transcription && isVoiceRequest(transcription))) {
    const textToSpeak = response.replace("[[VOICE_REPLY]]", "").trim();
    try {
      await ctx.replyWithChatAction("record_voice");
      console.log(`🔊 Generando respuesta de voz: "${textToSpeak.substring(0, 50)}..."`);
      
      const mp3Buffer = await textToSpeech(textToSpeak);
      const voiceBuffer = convertToVoice(mp3Buffer);
      
      await ctx.replyWithVoice(new InputFile(voiceBuffer, "voice.ogg"), {
        caption: transcription ? `🎤 "${transcription}"` : undefined
      });
      
      // Si el texto es muy largo, también enviamos el texto para referencia
      if (textToSpeak.length > 300) {
        await safeReply(ctx, textToSpeak, null);
      }
    } catch (voiceErr: any) {
      console.error("❌ Error de voz:", voiceErr.message);
      await safeReply(ctx, `${textToSpeak}\n\n⚠️ _(Nota: No pude generar el audio: ${voiceErr.message})_`, "Markdown");
    }
  } else {
    // Respuesta normal de texto
    const prefix = transcription ? `🎤 *"${transcription}"*\n\n` : "";
    await safeReply(ctx, prefix + response, transcription ? "Markdown" : null);
  }
}

// Middleware: Whitelist security
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || "sin_username";
  
  if (userId && config.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
    console.log(`📩 Recibido mensaje de @${username} (${userId})`);
    return next();
  } else {
    console.warn(`🛑 Acceso denegado para: @${username} (ID: ${userId}).`);
    try {
       await ctx.reply(`Lo siento, no tienes permiso para usar este bot. Tu ID es: ${userId}. Pide al administrador que te añada.`);
    } catch (_) {}
  }
});

// Commands
bot.command("start", async (ctx) => {
  await safeReply(ctx, 
    "¡Hola! Soy *OpenGravity* 🤖\n\n" +
    "Estado: *Online y Operativo* ✅\n\n" +
    "Puedes:\n" +
    "✍️ Escribirme un mensaje\n" +
    "🎤 Enviarme un audio\n" +
    "🔊 Pedirme que responda *en voz*\n\n" +
    "¿En qué puedo ayudarte hoy?",
    "Markdown"
  );
});

// ✍️ Text Message Handling
bot.on("message:text", async (ctx) => {
  const chatId = ctx.from.id;
  const userText = ctx.message.text;

  try {
    await ctx.replyWithChatAction("typing");
    console.log(`[Bot] ✍️ Procesando texto: "${userText}"`);
    const response = await runAgent(chatId, userText);
    await handleAgentResponse(ctx, response);
  } catch (err: any) {
    console.error("❌ Bot error:", err.message);
    await ctx.reply("Lo siento, hubo un error procesando tu mensaje: " + err.message);
  }
});

// 🎤 Voice Message Handling (Groq Whisper)
bot.on("message:voice", async (ctx) => {
  const chatId = ctx.from.id;

  try {
    await ctx.replyWithChatAction("typing");

    const file = await ctx.api.getFile(ctx.message.voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const audioResponse = await fetch(fileUrl);
    
    if (!audioResponse.ok) throw new Error("No se pudo descargar el audio de Telegram.");
    
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    console.log(`🎤 Audio descargado (${audioBuffer.length} bytes). Transcribiendo...`);
    const transcription = await transcribeAudio(audioBuffer, "voice.ogg");

    if (!transcription) {
      console.warn("⚠️ Transcripción vacía.");
      await ctx.reply("No pude entender el audio. ¿Puedes repetirlo?");
      return;
    }

    console.log(`🎤 Transcripción exitosa: "${transcription}"`);
    const response = await runAgent(chatId, transcription);
    await handleAgentResponse(ctx, response, transcription);

  } catch (err: any) {
    console.error("❌ Error procesando audio:", err.stack);
    await ctx.reply("Lo siento, no pude procesar tu mensaje de voz. " + (err.message.includes("ffmpeg") ? "Falta FFmpeg en el sistema." : err.message));
  }
});

bot.catch((err) => {
  console.error("Critical Telegram Bot Error:", err);
});

// Start
console.log("🚀 OpenGravity Bot Iniciado... Esperando mensajes.");
bot.start().catch(err => {
  console.error("❌ Falló el inicio del bot:", err.message);
});

// Health check server
import http from "http";
const PORT = process.env.PORT || 7860;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OpenGravity Bot is Running 🤖\n");
}).listen(PORT, () => {
  console.log(`📡 Health check server listo en puerto ${PORT}`);
});

