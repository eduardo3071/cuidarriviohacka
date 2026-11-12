import { fmtDate, fmtNum } from "../lib/format";
import { groupSamples, METRIC_META } from "../lib/wearables";
import type { EvidenceSeries, WearableSample } from "../types";
import { MiniChart } from "./MiniChart";

interface Card {
  title: string;
  metrics: string[]; // 1 ou 2 metricas no mesmo grafico (pressao: sistolica + diastolica)
  mode?: "line" | "events";
}

const CARDS: Card[] = [
  { title: "Frequência cardíaca em repouso", metrics: ["resting_hr"] },
  { title: "Variabilidade (HRV)", metrics: ["hrv_sdnn"] },
  { title: "Oxigênio mínimo na noite", metrics: ["spo2_min"] },
  { title: "Sono por noite", metrics: ["sleep_minutes"] },
  { title: "Pressão (medida em casa)", metrics: ["systolic", "diastolic"] },
  { title: "Avisos de ritmo irregular do relógio", metrics: ["irregular_rhythm_event"], mode: "events" },
];

/** Os sinais do relogio ao longo do tempo, todos no mesmo periodo para dar para comparar de cima a baixo. */
export function WearablesPanel({ samples }: { samples: WearableSample[] }) {
  if (samples.length === 0) return <p className="muted">Nenhum dado de relógio conectado.</p>;
  const by = groupSamples(samples);
  const times = samples.map((s) => Date.parse(s.t));
  const from = new Date(Math.min(...times)).toISOString();
  const to = new Date(Math.max(...times)).toISOString();

  return (
    <section aria-label="Sinais do relógio" className="wear-grid">
      {CARDS.map((card) => {
        const series: EvidenceSeries[] = card.metrics.map((m) => ({
          metric: m,
          unit: METRIC_META[m]?.unit ?? "",
          points: (by.get(m) ?? []).map((s) => ({ t: s.t, v: s.value })),
        }));
        const first = series[0]!;
        const last = first.points[first.points.length - 1];
        const meta = METRIC_META[card.metrics[0]!];
        const second = series[1]?.points[series[1].points.length - 1];
        const divisor = meta?.divisor ?? 1;
        const latest =
          card.mode === "events"
            ? `${first.points.length} ${first.points.length === 1 ? "aviso" : "avisos"} no período`
            : last
              ? second
                ? `${fmtNum(last.v)}/${fmtNum(second.v)} ${meta?.unit}`
                : `${fmtNum(last.v / divisor)} ${meta?.unit}`
              : "sem dados";
        return (
          <article key={card.title} className="wear" data-testid="wear-card">
            <h3>{card.title}</h3>
            <p className="wear-latest">
              <strong>{latest}</strong>
              {last && card.mode !== "events" && <span className="muted"> · {fmtDate(last.t.slice(0, 10))}</span>}
            </p>
            <MiniChart
              title={card.title}
              series={series}
              domainFrom={from}
              domainTo={to}
              mode={card.mode ?? "line"}
              divisor={divisor}
              unitLabel={meta?.unit}
              height={140}
            />
          </article>
        );
      })}
    </section>
  );
}
