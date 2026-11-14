import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import type { HealthData } from "../types";
import { TourPanel, type TourPanelProps } from "./TourPanel";
import { buildSteps } from "./steps";

const steps = buildSteps(demo as HealthData);
const noop = () => {};
const render = (over: Partial<TourPanelProps> = {}) => {
  const index = over.index ?? 1;
  return renderToStaticMarkup(
    <TourPanel step={steps[index]!} index={index} total={steps.length} collapsed={false} corner="direita" onPrev={noop} onNext={noop} onExit={noop} onToggle={noop} onMove={noop} {...over} />,
  );
};

describe("TourPanel", () => {
  it("mostra o passo, o titulo, o que falar e o gargalo que resolve", () => {
    const html = render({ index: 1 });
    expect(html).toContain(`Passo 2 de ${steps.length}`);
    expect(html).toContain(steps[1]!.title);
    expect(html).toContain(steps[1]!.fala);
    expect(html).toContain("Gargalo que resolve:");
    expect(html).toContain(steps[1]!.etapa);
  });

  it("e uma regiao anunciada para leitor de tela, com todos os controles rotulados", () => {
    const html = render();
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Apresentação guiada"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Sair da apresentação"');
    expect(html).toContain('aria-label="Recolher o painel"');
    expect(html).toContain("Mover o painel para a esquerda");
  });

  it("a trilha de progresso tem um ponto por passo e marca o atual", () => {
    const html = render({ index: 3 });
    expect((html.match(/<li/g) ?? []).length).toBe(steps.length);
    expect(html).toContain('aria-current="step"');
    expect((html.match(/class="done"/g) ?? []).length).toBe(3);
  });

  it("no primeiro passo nao da para voltar; nos demais, sim", () => {
    expect(render({ index: 0 })).toMatch(/<button[^>]*disabled[^>]*>(<span>)?Voltar/);
    expect(render({ index: 2 })).not.toMatch(/<button[^>]*disabled[^>]*>(<span>)?Voltar/);
  });

  it("no ultimo passo o botao vira Concluir", () => {
    const html = render({ index: steps.length - 1 });
    expect(html).toContain("Concluir");
    expect(html).not.toContain(">Próximo<");
    expect(render({ index: 0 })).toContain("Próximo");
  });

  it("recolhido, esconde o texto e oferece expandir", () => {
    const html = render({ collapsed: true });
    expect(html).toContain("tour-collapsed");
    expect(html).not.toContain(steps[1]!.fala);
    expect(html).toContain("Expandir o painel");
    expect(html).toContain(`Passo 2 de ${steps.length}`);
  });

  it("o canto escolhido vira classe e o rotulo de mover acompanha", () => {
    expect(render({ corner: "esquerda" })).toContain("tour-esquerda");
    expect(render({ corner: "esquerda" })).toContain("Mover o painel para a direita");
  });

  it("passo sem gargalo nao mostra a linha de gargalo", () => {
    const i = steps.findIndex((s) => !s.gargalo);
    expect(i).toBeGreaterThan(-1);
    expect(render({ index: i })).not.toContain("Gargalo que resolve:");
  });
});
