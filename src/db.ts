import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Cliente de Supabase - 100% GRATIS y seguro en la nube.
 * Se inicializa con los valores de tu archivo .env.
 */
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Guarda un mensaje en la nube de Supabase.
 * Soporta serialización de tool_calls para no romper la lógica de IA.
 */
export async function saveMessage(chatId: number, role: Message["role"], content: string | null, extra: Partial<Message> = {}) {
  try {
    let finalContent = content;
    
    // Si es un mensaje complejo (con herramientas), lo guardamos como JSON para no perder datos
    if (extra.tool_calls || extra.tool_call_id) {
      finalContent = JSON.stringify({
        text: content,
        tool_calls: extra.tool_calls,
        tool_call_id: extra.tool_call_id,
        name: extra.name
      });
    }

    const { error } = await supabase
      .from("messages")
      .insert([{ chat_id: chatId, role, content: finalContent }]);
    
    if (error) throw error;
  } catch (err) {
    console.error("Error al guardar historial en Supabase:", err);
  }
}

/**
 * Recupera los últimos mensajes de la nube de Supabase y deserializa si es necesario.
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
    
    const messages = (data || []).reverse().map(row => {
      let role = row.role as Message["role"];
      let content = row.content;
      let tool_calls = undefined;
      let tool_call_id = undefined;

      // Intentar detectar si es un JSON serializado
      if (content && content.startsWith('{') && content.endsWith('}')) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.tool_calls || parsed.tool_call_id) {
            content = parsed.text;
            tool_calls = parsed.tool_calls;
            tool_call_id = parsed.tool_call_id;
          }
        } catch (_) {
          // No era JSON, seguimos con el texto original
        }
      }

      return { role, content, tool_calls, tool_call_id };
    });

    return messages;
  } catch (err) {
    console.error("Error al recuperar historial de Supabase:", err);
    return [];
  }
}
