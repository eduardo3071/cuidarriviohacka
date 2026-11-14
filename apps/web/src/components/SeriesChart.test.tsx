import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import { buildSeries, labIndexes, pointKey } from "../lib/series";
import type { SeriesPoint } from "../types";
import { SeriesChart } from "./SeriesChart";

const points = demo.points as SeriesPoint[];
const series = buildSeries(points);
const labs = labIndexes(points);
const get = (n: string) => series.find((s) => s.biomarker === n)!;
const render = (name: string, selectedKey: string | null = null) =>
  renderToStaticMarkup(<SeriesChart series={get(name)} labIndex={labs} selectedKey={selectedKey} onSelect={() => {}} />);
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("SeriesChart", () => {
  const html = render("Glicemia de jejum");

  it("desenha um ponto e uma barra de faixa por leitura", () => {
    expect(count(html, 'data-testid="point"')).toBe(7);
    expect(count(html, 'data-testid="range-bar"')).toBe(7);
  });

  it("a bandeira de cada ponto vem da faixa do proprio laudo (4 na faixa, 3 acima)", () => {
    expect(count(html, 'data-flag="in_range"')).toBe(4);
    expect(count(html, 'data-flag="above"')).toBe(3);
    expect(count(html, "<circle class=\"marker marker-in_range\"")).toBe(4);
    expect(count(html, '<path class="marker marker-above"')).toBe(3); // triangulo: nao depende so da cor
  });

  it("legenda tem os tres laboratorios, e cada um usa a cor fixa dele", () => {
    expect(count(html, 'class="swatch lab-')).toBe(3);
    expect(html).toContain("Lakeside Medical Centre");
    expect(html).toContain("A <strong>barra</strong> atrás de cada ponto é a faixa de referência do laudo");
    expect(html).toContain('data-lab="Lakeside Medical Centre"');
  });

  it("e acessivel: imagem com titulo descritivo e pontos operaveis por teclado", () => {
    expect(html).toContain('role="img"');
    expect(html).toMatch(/<title id="chart-title">Glicemia de jejum: 7 resultados de 3 laboratórios, de 10\/05\/2016 a 28\/09\/2026/);
    expect(count(html, 'tabindex="0"')).toBe(7);
    expect(html).toContain('aria-label="21/08/2019, Lakeside Medical Centre: 99,09 mg/dL. dentro da faixa do laudo."');
  });

  it("nada vira NaN/undefined e nenhuma barra escapa do desenho", () => {
    for (const s of series) {
      const out = render(s.biomarker);
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
      for (const m of out.matchAll(/<rect class="range"[^>]*? y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)) {
        const y = Number(m[1]);
        const h = Number(m[2]);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + h).toBeLessThanOrEqual(340);
        expect(h).toBeGreaterThan(0);
      }
    }
  });

  it("faixa so com limite superior ('< 130') fica aberta embaixo e sem tampa la", () => {
    const ldl = render("Colesterol LDL");
    expect(count(ldl, 'data-open-low="true"')).toBe(7);
    expect(count(ldl, 'data-open-high="false"')).toBe(7);
    // cada barra tem so a tampa de cima: 7 barras => 7 tampas
    expect(count(ldl, 'class="cap"')).toBe(7);
  });

  it("faixa so com limite inferior ('> 50') fica aberta em cima", () => {
    const hdl = render("Colesterol HDL");
    expect(count(hdl, 'data-open-high="true"')).toBe(7);
  });

  it("marca o ponto selecionado uma vez so", () => {
    const last = get("Glicemia de jejum").points.at(-1)!;
    const sel = render("Glicemia de jejum", pointKey(last));
    expect(count(sel, 'class="ring"')).toBe(1);
    expect(count(sel, 'aria-pressed="true"')).toBe(1);
    expect(count(html, 'class="ring"')).toBe(0);
  });
});
