import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiFetch } from "./documents";

/** fetch para a API de laudos com o token do usuario logado (o getSession renova o token se ja venceu). */
export function makeApiFetch(client: SupabaseClient, baseUrl: string): ApiFetch {
  return async (path, init = {}) => {
    const { data } = await client.auth.getSession();
    const headers = new Headers(init.headers);
    if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  };
}
