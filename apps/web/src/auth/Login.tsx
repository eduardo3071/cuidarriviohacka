import { useState, type FormEvent } from "react";
import { loginErrorMessage, validateLogin } from "./messages";

export interface LoginProps {
  onSubmit: (email: string, password: string) => Promise<{ message?: string; status?: number; code?: string } | null>;
  onDemo: () => void;
  /** So para teste/SSR: mostra uma mensagem ja pronta. */
  initialError?: string | null;
}

export function Login({ onSubmit, onDemo, initialError = null }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateLogin(email, password);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      const err = await onSubmit(email.trim(), password);
      if (err) setError(loginErrorMessage(err));
    } catch (x) {
      setError(loginErrorMessage(x as Error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="panel login-card" onSubmit={submit} noValidate aria-labelledby="login-title">
        <h1 id="login-title">Hub de Saúde</h1>
        <p className="muted">Entre para ver o seu histórico ou os pacientes que liberaram o acesso a você.</p>

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <button type="button" className="link" onClick={onDemo}>
          Ver demonstração com dados sintéticos
        </button>
      </form>
    </main>
  );
}
