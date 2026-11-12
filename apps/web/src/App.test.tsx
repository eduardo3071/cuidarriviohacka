import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dashboard } from "./App";
import demo from "./demo/marta.json";
import type { HealthData, SeriesPoint } from "./types";

const data = demo as HealthData;
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("Dashboard (demonstracao)", () => {
  const html = renderToStaticMarkup(<Dashboard data={data} />);

  it("mostra a paciente, o aviso de dados sinteticos e o exame padrao", () => {
    expect(html).toContain("Marta Albuquerque Lima");
    expect(html).toContain("Dados sintéticos de demonstração");
    expect(html).toContain("<h2>Glicemia de jejum</h2>");
    expect(html).toContain("mesma unidade (mg/dL)");
  });

  it("lista os 11 exames e os 33 eventos da linha do tempo (28 + 5 alertas)", () => {
    expect((html.match(/<button type="button" class="bm( active)?"/g) ?? []).length).toBe(11);
    expect(count(html, 'data-testid="event"')).toBe(33);
  });

  it("o resultado selecionado por padrao e o mais recente, com laudo e normalizado lado a lado", () => {
    expect(html).toContain("Acima da faixa do laudo");
    expect(html).toContain("28/09/2026");
    expect(html).toContain("Diagnosticos Vita");
  });

  it("tem tabela de dados e o aviso de que nao e diagnostico", () => {
    expect(html).toContain("Ver os dados em tabela");
    expect(html).toContain("não faz diagnóstico");
  });

  it("sem exames e sem relogio mostra um estado vazio claro", () => {
    const empty = { ...data, points: [], wearables: [], alerts: [] };
    expect(renderToStaticMarkup(<Dashboard data={empty} />)).toContain("Nenhum resultado disponível ainda");
  });

  it("sem exames mas com relogio abre direto a aba do relogio (nao quebra)", () => {
    const out = renderToStaticMarkup(<Dashboard data={{ ...data, points: [] }} />);
    expect(out).toContain("<h2>Relógio e alertas</h2>");
    expect(out).not.toContain("Exames do histórico");
  });

  it("avisa quando alguma leitura nao pode ser normalizada (nao esconde em silencio)", () => {
    const extra: SeriesPoint = { ...(data.points[0] as SeriesPoint), normalization: "unit_unknown", value: null, ref_low: null, ref_high: null };
    const out = renderToStaticMarkup(<Dashboard data={{ ...data, points: [...data.points, extra] }} />);
    expect(out).toContain("1 leitura não pôde ser normalizada e não aparece nos gráficos.");
  });
});
