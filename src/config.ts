import dotenv from "dotenv";
import path from "path";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const rawAllowedIds = required("TELEGRAM_ALLOWED_USER_IDS");
const allowedUserIds = rawAllowedIds.split(",").map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

export const config = {
  TELEGRAM_BOT_TOKEN: required("TELEGRAM_BOT_TOKEN"),
  TELEGRAM_ALLOWED_USER_IDS: allowedUserIds,
  GROQ_API_KEY: required("GROQ_API_KEY"),
  OPENROUTER_API_KEY: required("OPENROUTER_API_KEY"),
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "openrouter/free",
  DB_PATH: process.env.DB_PATH || "./memory.db",
  SUPABASE_URL: (process.env.SUPABASE_URL || "").trim(),
  SUPABASE_KEY: (process.env.SUPABASE_KEY || "").trim(),
};
