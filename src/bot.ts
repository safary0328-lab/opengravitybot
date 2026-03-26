import { Bot } from "grammy";
import { config } from "./config.js";
import { runAgent } from "./agent.js";
import { transcribeAudio } from "./transcribe.js";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Middleware: Whitelist security
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId && config.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
    return next();
  } else {
    console.log(`Access denied for user ID: ${userId}`);
  }
});

// Commands
bot.command("start", async (ctx) => {
  await ctx.reply("¡Hola! Soy OpenGravity, tu agente de IA. Puedes escribirme o enviarme un 🎤 audio y lo entenderé. ¿En qué puedo ayudarte hoy?");
});

// Text Message Handling
bot.on("message:text", async (ctx) => {
  const chatId = ctx.from.id;
  const userText = ctx.message.text;

  try {
    await ctx.replyWithChatAction("typing");
    const response = await runAgent(chatId, userText);
    await ctx.reply(response);
  } catch (err: any) {
    console.error("Bot encountered an error:", err.message);
    await ctx.reply("Lo siento, hubo un error procesando tu mensaje.");
  }
});

// 🎤 Voice Message Handling (Groq Whisper)
bot.on("message:voice", async (ctx) => {
  const chatId = ctx.from.id;

  try {
    await ctx.replyWithChatAction("typing");

    // Descargar el audio de Telegram
    const file = await ctx.api.getFile(ctx.message.voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const audioResponse = await fetch(fileUrl);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Transcribir con Groq Whisper
    console.log("Transcribiendo audio con Groq Whisper...");
    const transcription = await transcribeAudio(audioBuffer, "voice.ogg");
    console.log(`Transcripción: "${transcription}"`);

    if (!transcription) {
      await ctx.reply("No pude entender el audio. ¿Puedes repetirlo?");
      return;
    }

    // Pasar la transcripción al agente
    const response = await runAgent(chatId, transcription);

    // Responder mostrando la transcripción y la respuesta
    await ctx.reply(`🎤 *"${transcription}"*\n\n${response}`, {
      parse_mode: "Markdown",
    });
  } catch (err: any) {
    console.error("Error procesando audio:", err.message);
    await ctx.reply("Lo siento, no pude transcribir tu audio. Inténtalo de nuevo.");
  }
});

// Error Handling
bot.catch((err) => {
  console.error("Critical Telegram Bot Error:", err);
});

// Start Long Polling
console.log("OpenGravity is running... (con soporte de voz 🎤)");
bot.start();
