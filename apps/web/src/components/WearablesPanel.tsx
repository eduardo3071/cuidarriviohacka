import { fmtNum } from "../lib/format";
import { dailyMean, groupSamples, METRIC_META } from "../lib/wearables";
import type { WearableSample } from "../types";
import "./phase3.css";

const CARDS: { title: string; metrics: string[]; events?: boolean }[] = [
  { title: "Frequência cardíaca em repouso", metrics: ["resting_hr"] },
  { title: "Variabilidade (HRV)", metrics: ["hrv_sdnn"] },
  { title: "Oxigênio mínimo na noite", metrics: ["spo2_min"] },
  { title: "Sono por noite", metrics: ["sleep_minutes"] },
  { title: "Pressão (medida em casa)", metrics: ["systolic", "diastolic"] },
  { title: "Avisos de ritmo irregular", metrics: ["irregular_rhythm_event"], events: true },
];
const DAY = 86_400_000;

function Spark({ pts, label }: { pts: number[]; label: string }) {
  if (pts.length === 0) return null;
  const W = 100, H = 40, lo = Math.min(...pts), hi = Math.max(...pts), r = hi - lo || 1;
  const xy = pts.map((v, i) => [pts.length === 1 ? W : (i / (pts.length - 1)) * W, H - 4 - ((v - lo) / r) * (H - 8)] as const);
  const [lx, ly] = xy[xy.length - 1]!;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" vectorEffect="non-scaling-stroke" />
      <line className="spark-dot" x1={lx} y1={ly} x2={lx} y2={ly} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Sinais do relógio: valor mais recente (média do dia) e mini gráfico com a média por dia dos últimos 7 dias. */
export function WearablesPanel({ samples }: { samples: WearableSample[] }) {
  if (samples.length === 0) return <p className="muted">Nenhum dado de relógio conectado.</p>;
  const by = groupSamples(samples);
  const end = Math.max(...samples.map((s) => Date.parse(s.t)));
  const recent = (list: WearableSample[]) => list.filter((s) => Date.parse(s.t) > end - 7 * DAY);
  return (
    <div className="wg">
      {CARDS.map((c) => {
        const meta = METRIC_META[c.metrics[0]!];
        const div = meta?.divisor ?? 1;
        const list = recent(by.get(c.metrics[0]!) ?? []);
        let value = "—", unit = meta?.unit ?? "", spark: number[] = [];
        if (c.events) {
          value = String(list.length);
          unit = list.length === 1 ? "aviso" : "avisos";
          const days = new Map<string, number>();
          for (let d = 6; d >= 0; d--) days.set(new Date(end - d * DAY).toISOString().slice(0, 10), 0);
          for (const s of list) { const k = s.t.slice(0, 10); if (days.has(k)) days.set(k, days.get(k)! + 1); }
          spark = [...days.values()];
        } else {
          const daily = dailyMean(list).map((p) => p.v / div);
          spark = daily;
          const last = daily[daily.length - 1];
          if (last !== undefined) {
            const second = c.metrics[1] ? dailyMean(recent(by.get(c.metrics[1]) ?? [])).at(-1) : undefined;
            value = second ? `${fmtNum(Math.round(last))}/${fmtNum(Math.round(second.v))}` : fmtNum(Math.round(last * 10) / 10);
          }
        }
        return (
          <article key={c.title} className="wg-card" data-testid="wear-card">
            <h4 className="wg-name">{c.title}</h4>
            <p className="wg-val"><strong>{value}</strong> <span className="caption">{unit}</span></p>
            <Spark pts={spark} label={`${c.title}: média por dia nos últimos 7 dias`} />
            <p className="caption">últimos 7 dias</p>
          </article>
        );
      })}
    </div>
  );
}
