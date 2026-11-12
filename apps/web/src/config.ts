const env = import.meta.env as Record<string, string | undefined>;

/** Lido do .env da raiz (so variaveis VITE_ chegam ao navegador). A chave aqui e a PUBLICAVEL (sb_publishable_...). */
export const config = {
  supabaseUrl: env.VITE_SUPABASE_URL ?? "",
  supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  /** Enquanto os dados forem de demonstracao, a tela mantem o aviso "dados sinteticos". */
  synthetic: env.VITE_SYNTHETIC_DATA !== "false",
};

/** Sem URL e chave, o app roda so em modo demonstracao (sem login). */
export const isConfigured = Boolean(config.supabaseUrl && config.supabaseKey);
