import { scaleLinear, scaleUtc } from "d3-scale";
import { fmtNum } from "../lib/format";
import { useWidth } from "../lib/useWidth";
import { metricLabel } from "../lib/wearables";
import type { EvidenceSeries, ReferenceLine } from "../types";

const M = { top: 24, right: 12, bottom: 22, left: 42 };
const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const ms = (iso: string) => Date.parse(iso);

export interface MiniChartProps {
  title: string; // descricao acessivel
  series: EvidenceSeries[];
  referenceLines?: ReferenceLine[];
  baseline?: { value: number; label: string };
  domainFrom?: string; // ISO: fixa o eixo do tempo (ex.: a janela que o motor analisou)
  domainTo?: string;
  mode?: "line" | "events";
  divisor?: number; // valor exibido = valor / divisor
  unitLabel?: string;
  height?: number;
}

/** Grafico pequeno de uma ou duas series (ex.: sistolica e diastolica), com linhas de referencia e da linha
 *  de base, ou, no modo "events", uma marca por aviso. Usado na evidencia dos alertas e nos sinais do relogio. */
export function MiniChart({
  title, series, referenceLines = [], baseline, domainFrom, domainTo, mode = "line", divisor = 1, unitLabel, height = 150,
}: MiniChartProps) {
  const [ref, W] = useWidth(360, 240);
  const data = series.map((s) => ({ ...s, pts: s.points.map((p) => ({ x: ms(p.t), y: p.v / divisor })) }));
  const all = data.flatMap((s) => s.pts);
  if (all.length === 0) return <p className="muted">Sem dados neste período.</p>;

  const fixed = Boolean(domainFrom && domainTo);
  const t0 = domainFrom ? ms(domainFrom) : Math.min(...all.map((p) => p.x));
  const t1 = domainTo ? ms(domainTo) : Math.max(...all.map((p) => p.x));
  const xPad = fixed ? 0 : Math.max((t1 - t0) * 0.03, 12 * 3_600_000);
  const x = scaleUtc().domain([new Date(t0 - xPad), new Date(t1 + xPad)]).range([M.left, W - M.right]);

  const refs = referenceLines.filter((r) => series.some((s) => s.metric === r.metric));
  const ys = [...all.map((p) => p.y), ...refs.map((r) => r.value / divisor), ...(baseline ? [baseline.value / divisor] : [])];
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
  const bottom = height - M.bottom;
  const y = scaleLinear().domain([lo - pad, hi + pad]).range([bottom, M.top]).nice(4);

  const dots = all.length <= 40;
  // Os textos ficam na legenda, nunca em cima dos dados (a linha passa por la e o rotulo ficaria ilegivel).
  const legend: { text: string; kind: "series" | "ref" | "base"; cls?: string }[] = [
    ...(series.length > 1 ? series.map((s, i) => ({ text: metricLabel(s.metric), kind: "series" as const, cls: `s${i}` })) : []),
    ...(mode === "line" ? refs.map((r) => ({ text: r.label, kind: "ref" as const })) : []),
    ...(mode === "line" && baseline ? [{ text: baseline.label, kind: "base" as const }] : []),
  ];
  const ariaLabel = mode === "events" ? `${title}: ${all.length} ${all.length === 1 ? "aviso" : "avisos"}` : `${title}: ${all.length} pontos`;

  return (
    <figure className="mini" ref={ref}>
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel}>
        {mode === "line" &&
          y.ticks(4).map((t) => (
            <g key={`y${t}`}>
              <line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {fmtNum(t)}
              </text>
            </g>
          ))}
        {mode === "events" && <line className="grid" x1={M.left} x2={W - M.right} y1={bottom} y2={bottom} />}
        {x.ticks(Math.max(2, Math.floor(W / 95))).map((t) => (
          <text key={`x${t.getTime()}`} className="tick" x={x(t)} y={height - 6} textAnchor="middle">
            {dayFmt.format(t)}
          </text>
        ))}
        {unitLabel && (
          <text className="unit" x={M.left - 6} y={10} textAnchor="end">
            {unitLabel}
          </text>
        )}

        {mode === "line" && baseline && (
          <g data-testid="baseline">
            <line className="baseline" x1={M.left} x2={W - M.right} y1={y(baseline.value / divisor)} y2={y(baseline.value / divisor)} />
          </g>
        )}
        {mode === "line" &&
          refs.map((r) => (
            <g key={`${r.metric}${r.value}`} data-testid="ref-line">
              <line className="ref" x1={M.left} x2={W - M.right} y1={y(r.value / divisor)} y2={y(r.value / divisor)} />
            </g>
          ))}

        {mode === "line" &&
          data.map((s, i) => (
            <g key={s.metric} className={`s${i}`}>
              <polyline
                className="line"
                data-testid="series-line"
                fill="none"
                points={s.pts.map((p) => `${x(new Date(p.x)).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")}
              />
              {dots && s.pts.map((p) => <circle key={p.x} className="dot" cx={x(new Date(p.x))} cy={y(p.y)} r={2.6} />)}
            </g>
          ))}

        {mode === "events" &&
          all.map((p) => (
            <g key={p.x} className="event" data-testid="event-tick">
              <line x1={x(new Date(p.x))} x2={x(new Date(p.x))} y1={bottom} y2={bottom - 44} />
              <circle cx={x(new Date(p.x))} cy={bottom - 44} r={5} />
            </g>
          ))}
      </svg>
      {legend.length > 0 && (
        <ul className="mini-legend">
          {legend.map((it) => (
            <li key={it.text} className={it.cls}>
              <span className={`mini-key ${it.kind}`} aria-hidden="true" /> {it.text}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
