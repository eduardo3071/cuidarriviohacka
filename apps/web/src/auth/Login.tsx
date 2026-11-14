import { useRef, useState, type FormEvent } from "react";
import { CircleAlert, FileText, LoaderCircle, Ruler, ShieldCheck } from "lucide-react";
import { Brand } from "../components/AppShell";
import { Button, Input } from "../components/ui";
import { loginErrorMessage, validateLogin } from "./messages";
import "./login.css";

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
  const [invalidField, setInvalidField] = useState<"email" | "password" | null>(null);
  const submitting = useRef(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    const invalid = validateLogin(email, password);
    if (invalid) {
      setInvalidField(validateLogin(email, "x") ? "email" : "password");
      setError(invalid);
      return;
    }
    submitting.current = true;
    setInvalidField(null);
    setBusy(true);
    setError(null);
    try {
      const err = await onSubmit(email.trim(), password);
      if (err) setError(loginErrorMessage(err));
    } catch (x) {
      setError(loginErrorMessage(x as Error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="login login-phase-one">
      <div className="login-layout">
        <section className="login-intro" aria-labelledby="login-value">
          <Brand />
          <h1 id="login-value">Seu histórico de saúde, organizado e só seu</h1>
          <ul className="login-benefits">
            <li><FileText size={24} strokeWidth={1.75} aria-hidden="true" /><span>Organiza exames de papel e PDF</span></li>
            <li><Ruler size={24} strokeWidth={1.75} aria-hidden="true" /><span>Mostra cada resultado contra a faixa do próprio laudo</span></li>
            <li><ShieldCheck size={24} strokeWidth={1.75} aria-hidden="true" /><span>Você decide quem pode ver</span></li>
          </ul>
        </section>
        <form className="login-form" onSubmit={submit} noValidate aria-labelledby="login-title" aria-busy={busy}>
          <h2 id="login-title">Entre na sua conta</h2>
          <Input label="E-mail" id="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} error={invalidField === "email" ? error ?? undefined : undefined} required />
          <Input
          label="Senha"
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          error={invalidField === "password" ? error ?? undefined : undefined}
          required
        />

        {error && !invalidField && (
          <p className="login-error" role="alert">
            <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" /><span>{error}</span>
          </p>
        )}

        <Button type="submit" disabled={busy} icon={busy ? LoaderCircle : undefined} className={busy ? "login-submit login-submit-busy" : "login-submit"}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
        <Button variant="link" onClick={onDemo} disabled={busy} className="login-demo">
          Ver demonstração com dados sintéticos
        </Button>
      </form>
      </div>
    </main>
  );
}
