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
    expect(html).toContain("lucide-triangle-alert");
    expect(html).toContain("<span>Atenção</span>");
    expect(html).toContain("<span>Informação</span>");
  });

  it("cada alerta tem 'Ver por quê' e o painel mostra regra, valor observado e janela", () => {
    expect(count(html, "Ver por quê")).toBe(10);
    expect(html).toContain("<dt>Regra</dt>");
    expect(html).toContain("<dt>Valor observado</dt>");
    expect(html).toContain("<dt>Janela</dt>");
    expect(html).toContain("Converse com um médico");
    expect(html).toContain("Este alerta orienta; não faz diagnóstico.");
  });

  it("deixa claro que a deteccao de ritmo e do relogio, nao do painel", () => {
    const rhythm = alerts.filter((a) => a.evidence.series[0]?.metric === "irregular_rhythm_event");
    expect(renderToStaticMarkup(<AlertsPanel alerts={rhythm} />)).toContain("O aviso é uma detecção do próprio relógio");
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
