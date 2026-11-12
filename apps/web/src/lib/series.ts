import type { Flag, SeriesPoint } from "../types";

/** Ponto desenhavel: ja normalizado para a unidade canonica. */
export type ChartPoint = Omit<SeriesPoint, "value" | "biomarker" | "unit_canonical"> & {
  value: number;
  biomarker: string;
  unit_canonical: string;
};

export interface Series {
  biomarker: string;
  category: string | null;
  unit: string;
  points: ChartPoint[]; // em ordem de data
}

const isChartable = (p: SeriesPoint): p is ChartPoint =>
  p.biomarker !== null &&
  p.unit_canonical !== null &&
  p.value !== null &&
  (p.normalization === "canonical" || p.normalization === "converted");

/** Agrupa por biomarcador. Leituras que nao puderam ser normalizadas (unidade desconhecida ou exame
 *  nao reconhecido) ficam FORA do grafico: melhor nao desenhar do que desenhar um valor inventado. */
export function buildSeries(points: SeriesPoint[]): Series[] {
  const by = new Map<string, ChartPoint[]>();
  for (const p of points) {
    if (!isChartable(p)) continue;
    const list = by.get(p.biomarker) ?? [];
    list.push(p);
    by.set(p.biomarker, list);
  }
  return [...by.entries()]
    .map(([biomarker, pts]) => {
      const sorted = [...pts].sort((a, b) => a.collected_at.localeCompare(b.collected_at));
      const first = sorted[0]!;
      return { biomarker, category: first.category, unit: first.unit_canonical, points: sorted };
    })
    .sort((a, b) => a.biomarker.localeCompare(b.biomarker, "pt-BR"));
}

/** Variacao abaixo disso (em %) e tratada como estavel. */
export const STABLE_PCT = 3;

export interface Summary {
  first: ChartPoint;
  latest: ChartPoint;
  changePct: number | null; // do primeiro ao ultimo valor normalizado; null se o primeiro for 0
  trend: "up" | "down" | "flat";
  outOfRange: number; // leituras fora da faixa do PROPRIO laudo
  labs: string[]; // laboratorios distintos, na ordem em que aparecem
}

export function summarize(s: Series): Summary {
  const first = s.points[0]!;
  const latest = s.points[s.points.length - 1]!;
  const changePct = first.value === 0 ? null : ((latest.value - first.value) / Math.abs(first.value)) * 100;
  const trend = changePct === null || Math.abs(changePct) < STABLE_PCT ? "flat" : changePct > 0 ? "up" : "down";
  const labs = [...new Set(s.points.map((p) => p.lab_name ?? "Laboratório não informado"))];
  const outOfRange = s.points.filter((p) => p.flag === "above" || p.flag === "below").length;
  return { first, latest, changePct, trend, outOfRange, labs };
}

export interface Domain {
  xMin: number; // ms UTC
  xMax: number;
  yMin: number;
  yMax: number;
}

const DAY = 86_400_000;
export const toTime = (iso: string): number => Date.parse(`${iso}T12:00:00Z`);

/** Dominio que cobre valores E faixas (a banda nao pode sair do desenho) com uma folga. */
export function chartDomain(points: ChartPoint[]): Domain {
  const ys = points.flatMap((p) => [p.value, p.ref_low, p.ref_high]).filter((v): v is number => v !== null);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  const times = points.map((p) => toTime(p.collected_at));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const xPad = Math.max((t1 - t0) * 0.04, 45 * DAY);
  return {
    xMin: t0 - xPad,
    xMax: t1 + xPad,
    yMin: lo >= 0 ? Math.max(0, lo - pad) : lo - pad, // exame nao fica negativo so por causa da folga
    yMax: hi + pad,
  };
}

export interface RangeBar {
  low: number;
  high: number;
  openLow: boolean; // laudo so tinha limite superior ("< 130"): a barra vai ate o piso do grafico
  openHigh: boolean; // laudo so tinha limite inferior ("> 50"): a barra vai ate o topo do grafico
}

/** A faixa DO LAUDO deste ponto, como barra. Sem faixa no laudo, sem barra. */
export function rangeBar(p: ChartPoint, d: Pick<Domain, "yMin" | "yMax">): RangeBar | null {
  if (p.ref_low === null && p.ref_high === null) return null;
  return {
    low: p.ref_low ?? d.yMin,
    high: p.ref_high ?? d.yMax,
    openLow: p.ref_low === null,
    openHigh: p.ref_high === null,
  };
}

export const labName = (p: Pick<SeriesPoint, "lab_name">): string => p.lab_name ?? "Laboratório não informado";

/** Identifica um ponto dentro de uma serie (data + nome no laudo + laboratorio). */
export const pointKey = (p: Pick<SeriesPoint, "collected_at" | "raw_name" | "lab_name">): string =>
  `${p.collected_at}|${p.raw_name}|${p.lab_name ?? ""}`;

/** Indice estavel de cor por laboratorio: o mesmo laboratorio tem a mesma cor em qualquer exame. */
export function labIndexes(allPoints: SeriesPoint[]): Map<string, number> {
  const names = [...new Set(allPoints.map((p) => p.lab_name ?? "Laboratório não informado"))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  return new Map(names.map((n, i) => [n, i]));
}

export const LAB_COLOR_COUNT = 6;

export const FLAG_ORDER: Record<Flag, number> = { above: 0, below: 1, no_range: 2, in_range: 3 };

/** Lista lateral: o que merece atencao primeiro (ultimo resultado fora da faixa), depois por nome. */
export function sortForList(series: Series[]): Series[] {
  const rank = (s: Series) => FLAG_ORDER[s.points[s.points.length - 1]!.flag];
  return [...series].sort((a, b) => rank(a) - rank(b) || a.biomarker.localeCompare(b.biomarker, "pt-BR"));
}
