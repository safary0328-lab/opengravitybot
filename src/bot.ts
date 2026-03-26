import { Bot } from "grammy";
import { config } from "./config.js";
import { runAgent } from "./agent.js";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Middleware: Whitelist security
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId && config.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
    return next();
  } else {
    console.log(`Access denied for user ID: ${userId}`);
    // Optionally: bot.api.sendMessage(userId, "Access denied.");
  }
});

// Commands
bot.command("start", async (ctx) => {
  await ctx.reply("¡Hola! Soy OpenGravity, tu agente local. ¿En qué puedo ayudarte hoy?");
});

// Message Handling
bot.on("message:text", async (ctx) => {
  const chatId = ctx.from.id;
  const userText = ctx.message.text;

  try {
    // Basic typing indicator
    await ctx.replyWithChatAction("typing");
    
    // Run the agent loop
    const response = await runAgent(chatId, userText);
    
    // Final reply to user
    await ctx.reply(response);
  } catch (err: any) {
    console.error("Bot encountered an error:", err.message);
    await ctx.reply("Lo siento, hubo un error procesando tu mensaje.");
  }
});

// Error Handling
bot.catch((err) => {
  console.error("Critical Telegram Bot Error:", err);
});

// Start Long Polling
console.log("OpenGravity is running...");
bot.start();
