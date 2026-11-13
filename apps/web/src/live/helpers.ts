/** Apoio dos testes AO VIVO (Supabase real). Nunca imprime chaves nem tokens. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const REPO_ROOT = resolve(__dirname, "../../../..");

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(resolve(REPO_ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]!] = m[2]!.replace(/^['"]|['"]$/g, "");
  }
  return out;
}

export const env = readEnv();
export const URL_ = env.VITE_SUPABASE_URL!;
export const PUBLISHABLE = env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = env.SUPABASE_SECRET_KEY!;
export const EMAIL = { patient: "marta@demo.rivio.test", doctor: "dr.henrique@demo.rivio.test" };

// chaves sb_ nao sao JWT: vao so no cabecalho apikey, nunca em Authorization
export const adminHeaders = { apikey: SECRET, "Content-Type": "application/json" };

/** Sessao real sem senha: link magico administrativo -> verify -> setSession, como o navegador teria depois do login. */
export async function session(email: string): Promise<{ client: SupabaseClient; userId: string }> {
  const link = await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ type: "magiclink", email }) });
  if (!link.ok) throw new Error(`generate_link HTTP ${link.status}`);
  const hashed = ((await link.json()) as { hashed_token: string }).hashed_token;
  const ver = await fetch(`${URL_}/auth/v1/verify`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ type: "magiclink", token_hash: hashed }) });
  if (!ver.ok) throw new Error(`verify HTTP ${ver.status}`);
  const s = (await ver.json()) as { access_token: string; refresh_token: string; user: { id: string } };
  const client = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await client.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error) throw new Error(`setSession: ${error.code ?? "erro"}`);
  return { client, userId: s.user.id };
}

export async function adminCount(table: string): Promise<number> {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=id`, { headers: { ...adminHeaders, Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" } });
  return Number(r.headers.get("content-range")!.split("/")[1]);
}
