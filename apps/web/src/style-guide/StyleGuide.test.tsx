import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StyleGuide } from "./StyleGuide";
import { AppShell } from "../components/AppShell";

const html = renderToStaticMarkup(<StyleGuide />);
const count = (needle: string) => html.split(needle).length - 1;

describe("Guia de estilo da fase 0", () => {
  it("apresenta a régua nos quatro estados do contrato", () => {
    for (const flag of ["above", "below", "in_range", "no_range"]) {
      expect(html).toContain(`ruler state-${flag}`);
    }
    expect(count('class="ruler state-')).toBeGreaterThanOrEqual(4);
  });

  it("usa os sete resultados e três eventos existentes da demonstração", () => {
    expect(html).toContain("Marta Albuquerque Lima");
    expect(html).toContain("Dados sintéticos de demonstração");
    expect(count('data-testid="point"')).toBe(7);
    expect(count('class="thread-dot"')).toBe(3);
  });

  it("inclui o casco e os componentes interativos pedidos", () => {
    expect(html).toContain("Navegação principal");
    expect(html).toContain("Navegação lateral");
    expect(html).toContain("Menu da conta de Marta Albuquerque Lima");
    expect(html).toContain("Sair");
    for (const label of ["Ação principal", "Abrir janela", "Revogar acesso", "Mostrar aviso"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Carregando conteúdo");
    expect(html).toContain("Nenhum resultado por aqui");
    expect(html).toContain("Não foi possível carregar");
  });

  it("oferece somente Meus pacientes na navegação principal do médico", () => {
    const doctor = renderToStaticMarkup(<AppShell doctor current="pacientes" onGo={() => {}} accountName="Dr. Henrique"><p>Conteúdo</p></AppShell>);
    expect((doctor.match(/class="bn-item"/g) ?? []).length).toBe(1);
    expect(doctor).toContain("Meus pacientes");
    expect(doctor).not.toContain(">Enviar<");
    expect(doctor).not.toContain(">Acessos<");
  });
});
