import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import { evidenceChartOptions } from "../lib/wearables";
import type { Alert, HealthData } from "../types";
import { MiniChart } from "./MiniChart";

const alerts = (demo as unknown as HealthData).alerts;
const ev = (kind: string) => alerts.find((a: Alert) => a.kind === kind)!.evidence;
const count = (html: string, needle: string) => html.split(needle).length - 1;

function chartFor(kind: string) {
  const e = ev(kind);
  const o = evidenceChartOptions(e);
  return renderToStaticMarkup(
    <MiniChart
      title={kind}
      series={e.series}
      referenceLines={e.reference_lines}
      baseline={e.baseline}
      domainFrom={e.window.from}
      domainTo={e.window.to}
      mode={o.mode}
      divisor={o.divisor}
      unitLabel={o.unitLabel}
    />,
  );
}

describe("MiniChart", () => {
  it("FC de repouso: uma linha e a linha de base ('seu padrao')", () => {
    const html = chartFor("resting_hr_rise");
    expect(count(html, 'data-testid="series-line"')).toBe(1);
    expect(count(html, 'data-testid="baseline"')).toBe(1);
    expect(html).toContain("seu padrão: 64 bpm");
  });

  it("pressao: duas linhas (sistolica e diastolica), duas referencias e legenda", () => {
    const html = chartFor("high_blood_pressure");
    expect(count(html, 'data-testid="series-line"')).toBe(2);
    expect(count(html, 'data-testid="ref-line"')).toBe(2);
    expect(html).toContain("Pressão sistólica");
    expect(html).toContain("Pressão diastólica");
    expect(html).toContain("limite da regra: 135");
  });

  it("avisos de ritmo: uma marca por aviso e nenhuma linha", () => {
    const html = chartFor("irregular_rhythm");
    expect(count(html, 'data-testid="event-tick"')).toBe(4);
    expect(count(html, 'data-testid="series-line"')).toBe(0);
    expect(html).toContain("4 avisos");
  });

  it("oxigenio: linha de referencia dos 90%", () => {
    const html = chartFor("low_oxygen_sleep");
    expect(count(html, 'data-testid="ref-line"')).toBe(1);
    expect(html).toContain("limite da regra: 90%");
  });

  it("sono desenhado em HORAS (os dados vem em minutos)", () => {
    const html = chartFor("sleep_reduction");
    const ticks = [...html.matchAll(/class="tick"[^>]*>([\d,.]+)</g)].map((m) => Number(m[1]!.replace(",", ".")));
    const yTicks = ticks.filter((t) => t < 100);
    expect(yTicks.length).toBeGreaterThan(0);
    expect(Math.max(...yTicks)).toBeLessThan(24);
    expect(html).toContain("limite da regra: 6 h");
  });

  it("nada vira NaN/undefined em nenhum alerta", () => {
    for (const a of alerts) expect(chartFor(a.kind)).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("sem pontos mostra aviso; com um ponto so nao quebra", () => {
    expect(renderToStaticMarkup(<MiniChart title="x" series={[{ metric: "resting_hr", unit: "bpm", points: [] }]} />)).toContain(
      "Sem dados neste período",
    );
    const one = renderToStaticMarkup(
      <MiniChart title="x" series={[{ metric: "resting_hr", unit: "bpm", points: [{ t: "2026-11-01T07:00:00-03:00", v: 64 }] }]} />,
    );
    expect(one).not.toMatch(/NaN|Infinity/);
  });

  it("e acessivel: imagem com descricao", () => {
    expect(chartFor("irregular_rhythm")).toContain('role="img"');
  });
});
