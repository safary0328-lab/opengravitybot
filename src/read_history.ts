
import { getHistory } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const chatId = parseInt(process.env.TELEGRAM_ALLOWED_USER_IDS || "0");
  if (!chatId) {
    console.log("No chat ID in .env");
    return;
  }
  const history = await getHistory(chatId, 5);
  console.log("Last 5 messages for", chatId);
  console.log(JSON.stringify(history, null, 2));
}

main();
