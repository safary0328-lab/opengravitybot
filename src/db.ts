import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Cliente de Supabase - 100% GRATIS y seguro en la nube.
 * Se inicializa con los valores de tu archivo .env.
 */
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

/**
 * Guarda un mensaje en la nube de Supabase.
 */
export async function saveMessage(chatId: number, role: Message["role"], content: string) {
  try {
    const { error } = await supabase
      .from("messages")
      .insert([{ chat_id: chatId, role, content }]);
    
    if (error) throw error;
  } catch (err) {
    console.error("Error al guardar historial en Supabase:", err);
  }
}

/**
 * Recupera los últimos mensajes de la nube de Supabase.
 */
export async function getHistory(chatId: number, limit: number = 20): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("id", { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // Devolver en orden cronológico
    return (data || []).reverse().map(row => ({
      role: row.role as Message["role"],
      content: row.content
    }));
  } catch (err) {
    console.error("Error al recuperar historial de Supabase:", err);
    return [];
  }
}
