/** Mensagem de login em portugues. Nao diz se foi o e-mail ou a senha que errou (nao confirma que uma conta existe). */
export function loginErrorMessage(err: { message?: string; status?: number; code?: string } | null | undefined): string {
  const msg = (err?.message ?? "").toLowerCase();
  if (err?.code === "invalid_credentials" || msg.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (err?.code === "over_request_rate_limit" || err?.status === 429 || msg.includes("rate limit"))
    return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  if (msg.includes("email not confirmed")) return "Este e-mail ainda não foi confirmado.";
  if (msg.includes("fetch") || msg.includes("network")) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  return "Não foi possível entrar. Tente de novo.";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validacao leve antes de chamar o servidor: devolve a mensagem de erro ou null. */
export function validateLogin(email: string, password: string): string | null {
  if (!EMAIL.test(email.trim())) return "Informe um e-mail válido.";
  if (password.length === 0) return "Informe a senha.";
  return null;
}
