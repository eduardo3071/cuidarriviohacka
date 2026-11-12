import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

let client: SupabaseClient | null = null;

/** Cliente unico do navegador. Usa so a chave PUBLICAVEL: sem login, o RLS nao devolve nada. */
export function getSupabase(): SupabaseClient {
  client ??= createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
