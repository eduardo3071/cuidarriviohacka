import { describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import type { SeriesPoint } from "../types";
import { categoryLabel, fmtDate, fmtNum, fmtPercent, fmtRange } from "./format";
import { buildSeries, chartDomain, FLAG_ORDER, labIndexes, rangeBar, sortForList, summarize, type ChartPoint } from "./series";

const points = demo.points as SeriesPoint[];
const series = buildSeries(points);
const get = (name: string) => series.find((s) => s.biomarker === name)!;

const base: ChartPoint = {
  biomarker: "Glicemia de jejum", category: "Metabolismo", unit_canonical: "mg/dL", collected_at: "2021-09-02",
  lab_name: "X", raw_name: "Glicose", raw_value: 101, raw_unit: "mg/dL", raw_ref_low: 70, raw_ref_high: 99,
  ref_text: "70 - 99", normalization: "canonical", value: 101, ref_low: 70, ref_high: 99, flag: "above",
}; // fmt: skip

describe("buildSeries", () => {
  it("agrupa as 75 leituras em 11 exames, por data, em ordem alfabetica", () => {
    expect(series).toHaveLength(11);
    expect(series.reduce((n, s) => n + s.points.length, 0)).toBe(75);
    expect(series.map((s) => s.biomarker)).toEqual([...series.map((s) => s.biomarker)].sort((a, b) => a.localeCompare(b, "pt-BR")));
    for (const s of series) {
      const dates = s.points.map((p) => p.collected_at);
      expect(dates).toEqual([...dates].sort());
    }
  });

  it("glicemia vira UMA serie com tres laboratorios e a unidade canonica", () => {
    const g = get("Glicemia de jejum");
    expect(g.unit).toBe("mg/dL");
    expect(g.points.map((p) => p.value)).toEqual([91, 95, 99.088, 101, 106, 111, 118]);
    expect(new Set(g.points.map((p) => p.lab_name)).size).toBe(3);
  });

  it("a conversao com offset (HbA1c de mmol/mol para %) chega ao grafico, com o original preservado", () => {
    const lakeside = get("Hemoglobina glicada (HbA1c)").points.find((p) => p.normalization === "converted")!;
    expect(lakeside.value).toBeCloseTo(5.719, 3);
    expect([lakeside.raw_value, lakeside.raw_unit]).toEqual([39, "mmol/mol"]);
  });

  it("nao desenha o que nao foi normalizado (unidade desconhecida / exame nao reconhecido)", () => {
    const s = buildSeries([
      base,
      { ...base, collected_at: "2022-01-01", normalization: "unit_unknown", value: null, ref_low: null, ref_high: null },
      { ...base, collected_at: "2022-02-01", biomarker: null, unit_canonical: null, normalization: "unmapped", value: null },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]!.points).toHaveLength(1);
  });
});

describe("summarize", () => {
  it("glicemia: sobe ~30% desde 2016, 3 leituras fora da faixa do proprio laudo, 3 laboratorios", () => {
    const s = summarize(get("Glicemia de jejum"));
    expect([s.first.value, s.latest.value]).toEqual([91, 118]);
    expect(s.changePct).toBeCloseTo(29.67, 1);
    expect(s.trend).toBe("up");
    expect(s.outOfRange).toBe(3);
    expect(s.labs).toHaveLength(3);
  });

  it("variacao pequena e estavel; primeiro valor zero nao divide por zero", () => {
    const flat = summarize({ biomarker: "x", category: null, unit: "u", points: [{ ...base, value: 100 }, { ...base, collected_at: "2022-01-01", value: 101 }] });
    expect(flat.trend).toBe("flat");
    const zero = summarize({ biomarker: "x", category: null, unit: "u", points: [{ ...base, value: 0 }, { ...base, collected_at: "2022-01-01", value: 5 }] });
    expect(zero.changePct).toBeNull();
    expect(zero.trend).toBe("flat");
  });
});

describe("chartDomain e rangeBar", () => {
  it("o dominio cobre valores E faixas, com folga, sem ir abaixo de zero", () => {
    const g = get("Glicemia de jejum");
    const d = chartDomain(g.points);
    expect(d.yMin).toBeLessThan(70);
    expect(d.yMax).toBeGreaterThan(118);
    expect(d.yMin).toBeGreaterThanOrEqual(0);
    expect(d.xMin).toBeLessThan(Date.parse("2016-05-10"));
    expect(d.xMax).toBeGreaterThan(Date.parse("2026-09-28"));
    for (const s of series) {
      const dd = chartDomain(s.points);
      expect(dd.yMin).toBeGreaterThanOrEqual(0);
      for (const p of s.points) for (const v of [p.value, p.ref_low, p.ref_high]) if (v !== null) expect(v >= dd.yMin && v <= dd.yMax).toBe(true);
    }
  });

  it("faixa so com limite superior ('< 130') e barra aberta embaixo; so inferior, aberta em cima; nenhuma, sem barra", () => {
    const d = { yMin: 10, yMax: 200 };
    expect(rangeBar({ ...base, ref_low: null, ref_high: 130 }, d)).toEqual({ low: 10, high: 130, openLow: true, openHigh: false });
    expect(rangeBar({ ...base, ref_low: 50, ref_high: null }, d)).toEqual({ low: 50, high: 200, openLow: false, openHigh: true });
    expect(rangeBar({ ...base, ref_low: null, ref_high: null }, d)).toBeNull();
  });
});

describe("lista e cores", () => {
  it("o que merece atencao (ultimo resultado fora da faixa) vem primeiro", () => {
    const ranks = sortForList(series).map((s) => FLAG_ORDER[s.points[s.points.length - 1]!.flag]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks[0]).toBeLessThan(FLAG_ORDER.in_range);
  });

  it("cor de laboratorio estavel e independente do exame aberto", () => {
    const idx = labIndexes(points);
    expect([...idx.entries()]).toEqual([["Diagnosticos Vita", 0], ["Laboratorio Aurora", 1], ["Lakeside Medical Centre", 2]]);
    expect(labIndexes([...points].reverse())).toEqual(idx);
  });
});

describe("formatacao pt-BR", () => {
  it("numeros, datas, faixas, categorias e percentuais", () => {
    expect(fmtNum(99.088)).toBe("99,09");
    expect(fmtNum(1234.5)).toBe("1.234,5");
    expect(fmtDate("2016-05-10")).toBe("10/05/2016");
    expect(fmtRange(70, 99, "mg/dL")).toBe("70–99 mg/dL");
    expect(fmtRange(null, 130, "mg/dL")).toBe("até 130 mg/dL");
    expect(fmtRange(50, null, null)).toBe("a partir de 50");
    expect(fmtRange(null, null, "mg/dL")).toBeNull();
    expect(categoryLabel("Lipidios")).toBe("Lipídios");
    expect(categoryLabel("Funcao renal")).toBe("Função renal");
    expect(categoryLabel(null)).toBe("Outros");
    expect(fmtPercent(29.67)).toBe("+29,7%");
    expect(fmtPercent(-3.2)).toMatch(/^[-−]3,2%$/);
  });
});
