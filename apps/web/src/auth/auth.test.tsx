import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PatientList } from "../components/PatientList";
import { PrivacyView } from "../components/PrivacyView";
import type { Consent, Doctor } from "../data/api";
import { Login } from "./Login";
import { loginErrorMessage, validateLogin } from "./messages";

const NOW = new Date("2026-11-12T12:00:00Z");
const iso = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

describe("mensagens de login", () => {
  it("nao revela se o e-mail existe", () => {
    expect(loginErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("E-mail ou senha incorretos.");
    expect(loginErrorMessage({ message: "Invalid login credentials" })).toBe("E-mail ou senha incorretos.");
  });
  it("trata limite de tentativas, rede e desconhecido", () => {
    expect(loginErrorMessage({ status: 429 })).toMatch(/Muitas tentativas/);
    expect(loginErrorMessage({ message: "Failed to fetch" })).toMatch(/Sem conexão/);
    expect(loginErrorMessage(null)).toMatch(/Não foi possível entrar/);
  });
  it("valida e-mail e senha antes de chamar o servidor", () => {
    expect(validateLogin("sem-arroba", "x")).toMatch(/e-mail/);
    expect(validateLogin("a@b.co", "")).toMatch(/senha/);
    expect(validateLogin(" a@b.co ", "x")).toBeNull();
  });
  it("rejeita e-mail vazio sem enviar credenciais", () => {
    expect(validateLogin("", "senha")).not.toBeNull();
  });
  it("rejeita e-mail com espaços internos", () => {
    expect(validateLogin("nome sobrenome@exemplo.com", "senha")).not.toBeNull();
  });
  it("aceita e-mail válido com senha preenchida", () => {
    expect(validateLogin("marta@exemplo.com", "senha")).toBeNull();
  });
});

describe("Login", () => {
  it("tem campos rotulados, campo de senha mascarado e atalho para a demonstracao", () => {
    const html = renderToStaticMarkup(<Login onSubmit={async () => null} onDemo={() => {}} />);
    expect(html).toContain('for="email"');
    expect(html).toContain('type="password"');
    expect(html).toMatch(/autoComplete="current-password"/i);
    expect(html).toContain("Ver demonstração");
    expect(html).not.toContain('role="alert"');
  });
  it("mostra o erro como alerta acessivel", () => {
    const html = renderToStaticMarkup(<Login onSubmit={async () => null} onDemo={() => {}} initialError="E-mail ou senha incorretos." />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("E-mail ou senha incorretos.");
  });
});

const doctors: Doctor[] = [{ id: "d1", full_name: "Dra. Helena", crm: "CRM-SP 1" }];
const consent = (over: Partial<Consent>): Consent => ({
  id: "c1", patient_id: "p1", doctor_id: "d1", categories: ["exams"], granted_at: iso(-3), expires_at: iso(20), revoked_at: null, ...over,
});

describe("PrivacyView", () => {
  const render = (consents: Consent[], log = [] as { id: number; doctor_id: string; category: string; action: string; accessed_at: string }[]) =>
    renderToStaticMarkup(<PrivacyView doctors={doctors} consents={consents} log={log} onGrant={async () => {}} onRevoke={async () => {}} now={NOW} />);

  it("sem consentimento: ninguem tem acesso e nao ha botao de revogar", () => {
    const html = render([]);
    expect(html).toContain("Nenhum médico tem acesso agora");
    expect(html).not.toContain("Revogar acesso");
    expect(html).toContain("Nenhum acesso registrado ainda");
  });
  it("consentimento ativo mostra medico, categorias, validade e botao de revogar", () => {
    const html = render([consent({})]);
    expect(html).toContain("Dra. Helena");
    expect(html).toContain("Exames");
    expect(html).toContain("Revogar acesso");
  });
  it("revogado e vencido saem da lista ativa e vao para encerrados", () => {
    const html = render([consent({ id: "a", revoked_at: iso(-1) }), consent({ id: "b", expires_at: iso(-1) })]);
    expect(html).toContain("Nenhum médico tem acesso agora");
    expect(html).toContain("Acessos encerrados (2)");
    expect(html).toContain("revogado");
    expect(html).toContain("vencido");
  });
  it("lista quem abriu os dados", () => {
    const html = render([], [{ id: 1, doctor_id: "d1", category: "exams", action: "view", accessed_at: iso(-1) }]);
    expect(html).toContain("Dra. Helena");
    expect(html).toContain("abriu Exames");
  });
});

describe("PatientList", () => {
  it("vazio: explica que ninguem liberou", () => {
    expect(renderToStaticMarkup(<PatientList patients={[]} onOpen={() => {}} />)).toContain("Nenhum paciente liberou");
  });
  it("mostra o que foi liberado e ate quando", () => {
    const html = renderToStaticMarkup(
      <PatientList patients={[{ id: "p1", full_name: "Marta", categories: ["exams", "wearables"], expires_at: iso(10) }]} onOpen={() => {}} />,
    );
    expect(html).toContain("Marta");
    expect(html).toContain("Exames, Relógio e alertas");
    expect(html).toContain("Abrir");
  });
});
