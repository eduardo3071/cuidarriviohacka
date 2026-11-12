import type { Alert, Evidence, Severity, WearableSample } from "../types";

export interface MetricMeta {
  label: string;
  unit: string;
  divisor?: number; // valor exibido = valor / divisor (sono: minutos -> horas)
}

export const METRIC_META: Record<string, MetricMeta> = {
  resting_hr: { label: "Frequência cardíaca em repouso", unit: "bpm" },
  hrv_sdnn: { label: "Variabilidade da frequência (HRV)", unit: "ms" },
  spo2_min: { label: "Oxigênio mínimo na noite", unit: "%" },
  sleep_minutes: { label: "Sono por noite", unit: "h", divisor: 60 },
  systolic: { label: "Pressão sistólica", unit: "mmHg" },
  diastolic: { label: "Pressão diastólica", unit: "mmHg" },
  irregular_rhythm_event: { label: "Avisos de ritmo irregular", unit: "avisos" },
};

export const metricLabel = (m: string): string => METRIC_META[m]?.label ?? m;

export function groupSamples(samples: WearableSample[]): Map<string, WearableSample[]> {
  const by = new Map<string, WearableSample[]>();
  for (const s of samples) by.set(s.metric, [...(by.get(s.metric) ?? []), s]);
  for (const list of by.values()) list.sort((a, b) => a.t.localeCompare(b.t));
  return by;
}

export const SEVERITY_LABEL: Record<Severity, string> = { urgent: "Urgente", attention: "Atenção", info: "Informativo" };
/** Forma + texto: a gravidade nunca depende so da cor. */
export const SEVERITY_SYMBOL: Record<Severity, string> = { urgent: "■", attention: "▲", info: "●" };
const SEVERITY_RANK: Record<Severity, number> = { urgent: 0, attention: 1, info: 2 };

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.title.localeCompare(b.title, "pt-BR"),
  );
}

/** Quantos alertas merecem atencao agora (urgente + atencao; informativo nao conta). */
export const attentionCount = (alerts: Alert[]): number =>
  alerts.filter((a) => a.severity === "urgent" || a.severity === "attention").length;

export interface ChartOptions {
  mode: "line" | "events";
  divisor: number;
  unitLabel: string;
}

/** Como desenhar a evidencia de um alerta, a partir da PRIMEIRA serie dela. */
export function evidenceChartOptions(ev: Evidence): ChartOptions {
  const first = ev.series[0];
  const metric = first?.metric ?? "";
  const meta = METRIC_META[metric];
  return {
    mode: metric === "irregular_rhythm_event" ? "events" : "line",
    divisor: meta?.divisor ?? 1,
    unitLabel: meta?.unit ?? first?.unit ?? "",
  };
}
