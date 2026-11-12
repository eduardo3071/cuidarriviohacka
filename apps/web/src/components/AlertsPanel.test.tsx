import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import type { HealthData } from "../types";
import { AlertsPanel } from "./AlertsPanel";

const alerts = (demo as unknown as HealthData).alerts;
const html = renderToStaticMarkup(<AlertsPanel alerts={alerts} />);
const count = (h: string, needle: string) => h.split(needle).length - 1;

describe("AlertsPanel", () => {
  it("mostra os 5 alertas, os que pedem atencao primeiro", () => {
    expect(count(html, 'data-testid="alert"')).toBe(5);
    const order = [...html.matchAll(/data-severity="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["attention", "attention", "attention", "info", "info"]);
  });

  it("a gravidade aparece em TEXTO e forma, nao so em cor", () => {
    expect(html).toContain("▲</span> Atenção");
    expect(html).toContain("●</span> Informativo");
  });

  it("cada alerta tem 'Por que disparou?' com regra, observado e janela", () => {
    expect(count(html, "Por que disparou?")).toBe(5);
    expect(count(html, "<dt>Regra</dt>")).toBe(5);
    expect(count(html, "<dt>Observado</dt>")).toBe(5);
    expect(count(html, "<dt>Janela analisada</dt>")).toBe(5);
    expect(html).toContain("4 avisos entre 30/10 e 09/11");
    expect(html).toContain("2 ou mais avisos de ritmo irregular do relógio em 14 dias");
  });

  it("deixa claro que a deteccao de ritmo e do relogio, nao do painel", () => {
    expect(html).toContain("O aviso é uma detecção do próprio relógio");
  });

  it("toda mensagem orienta um medico e diz que nao e diagnostico", () => {
    for (const a of alerts) {
      expect(a.message).toContain("médico");
      expect(a.message).toContain("não é um diagnóstico");
    }
  });

  it("sem alertas diz que esta dentro do padrao", () => {
    expect(renderToStaticMarkup(<AlertsPanel alerts={[]} />)).toContain("Nenhum alerta no momento");
  });
});
