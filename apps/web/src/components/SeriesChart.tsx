import { scaleLinear, scaleUtc } from "d3-scale";
import { fmtDate, fmtNum, FLAG_LABEL } from "../lib/format";
import { useWidth } from "../lib/useWidth";
import {
  chartDomain,
  LAB_COLOR_COUNT,
  labName,
  pointKey,
  rangeBar,
  summarize,
  toTime,
  type ChartPoint,
  type Series,
} from "../lib/series";
import type { Flag } from "../types";

const DEFAULT_W = 760; // largura ate o navegador medir (e no teste de renderizacao em servidor)
const M = { top: 30, right: 20, bottom: 34, left: 54 };
const BAR_W = 14;

/** Altura proporcional a largura, entre 220 e 340: em tela estreita o grafico fica mais baixo, nao ilegivel. */
const heightFor = (w: number): number => Math.round(Math.min(340, Math.max(220, w * 0.45)));

const yearFmt = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "UTC" });

/** Forma + cor: a bandeira nao depende so da cor (circulo = na faixa, triangulo = fora). */
function Marker({ flag, cx, cy }: { flag: Flag; cx: number; cy: number }) {
  const r = 6;
  const cls = `marker marker-${flag}`;
  if (flag === "above") return <path className={cls} d={`M${cx},${cy - r - 1} L${cx + r + 1},${cy + r} L${cx - r - 1},${cy + r} Z`} />;
  if (flag === "below") return <path className={cls} d={`M${cx},${cy + r + 1} L${cx + r + 1},${cy - r} L${cx - r - 1},${cy - r} Z`} />;
  return <circle className={cls} cx={cx} cy={cy} r={r} />;
}

export interface SeriesChartProps {
  series: Series;
  labIndex: Map<string, number>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

/**
 * Evolucao de um exame. Cada ponto desenha a faixa de referencia DO LAUDO de onde veio (a barra
 * vertical atras dele), e a bandeira (forma/cor) e decidida por essa faixa. Valores de laboratorios e
 * unidades diferentes ja chegam na unidade canonica.
 */
export function SeriesChart({ series, labIndex, selectedKey, onSelect }: SeriesChartProps) {
  const { points, unit, biomarker } = series;
  const [figRef, W] = useWidth(DEFAULT_W, 280);
  const H = heightFor(W);
  const d = chartDomain(points);
  const x = scaleUtc().domain([new Date(d.xMin), new Date(d.xMax)]).range([M.left, W - M.right]);
  const y = scaleLinear().domain([d.yMin, d.yMax]).range([H - M.bottom, M.top]).nice(5);
  const [yLo, yHi] = y.domain() as [number, number]; // depois do nice: as barras abertas vao ate aqui
  const cx = (p: ChartPoint) => x(new Date(toTime(p.collected_at)));
  const s = summarize(series);
  const label = `${biomarker}: ${points.length} resultados de ${s.labs.length} ${s.labs.length === 1 ? "laboratório" : "laboratórios"}, de ${fmtDate(s.first.collected_at)} a ${fmtDate(s.latest.collected_at)}. Cada ponto tem a faixa de referência do seu laudo.`;
  const polyline = points.map((p) => `${cx(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  return (
    <figure className="chart" ref={figRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="chart-title" className="chart-svg">
        <title id="chart-title">{label}</title>

        {y.ticks(5).map((t) => (
          <g key={`y${t}`}>
            <line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        {x.ticks(6).map((t) => (
          <text key={`x${t.getTime()}`} className="tick" x={x(t)} y={H - M.bottom + 20} textAnchor="middle">
            {yearFmt.format(t)}
          </text>
        ))}
        <text className="unit" x={M.left - 8} y={M.top - 18} textAnchor="end">
          {unit}
        </text>

        <polyline className="trend" points={polyline} fill="none" />

        {points.map((p) => {
          const key = pointKey(p);
          const bar = rangeBar(p, { yMin: yLo, yMax: yHi });
          const idx = (labIndex.get(labName(p)) ?? 0) % LAB_COLOR_COUNT;
          const px = cx(p);
          const py = y(p.value);
          const selected = key === selectedKey;
          return (
            <g
              key={key}
              className={`pt lab-${idx}${selected ? " selected" : ""}`}
              data-testid="point"
              data-flag={p.flag}
              data-lab={labName(p)}
              tabIndex={0}
              role="button"
              aria-pressed={selected}
              aria-label={`${fmtDate(p.collected_at)}, ${labName(p)}: ${fmtNum(p.value)} ${unit}. ${FLAG_LABEL[p.flag]}.`}
              onClick={() => onSelect(key)}
              onFocus={() => onSelect(key)}
              onMouseEnter={() => onSelect(key)}
            >
              {bar && (
                <g data-testid="range-bar" data-open-low={bar.openLow} data-open-high={bar.openHigh}>
                  <rect
                    className="range"
                    x={px - BAR_W / 2}
                    y={y(bar.high)}
                    width={BAR_W}
                    height={Math.max(1, y(bar.low) - y(bar.high))}
                    rx={3}
                  />
                  {!bar.openHigh && <line className="cap" x1={px - BAR_W / 2 - 2} x2={px + BAR_W / 2 + 2} y1={y(bar.high)} y2={y(bar.high)} />}
                  {!bar.openLow && <line className="cap" x1={px - BAR_W / 2 - 2} x2={px + BAR_W / 2 + 2} y1={y(bar.low)} y2={y(bar.low)} />}
                </g>
              )}
              {selected && <circle className="ring" cx={px} cy={py} r={11} />}
              <Marker flag={p.flag} cx={px} cy={py} />
              <circle className="hit" cx={px} cy={py} r={13} />
            </g>
          );
        })}
      </svg>

      <figcaption className="legend">
        <ul className="labs" aria-label="Laboratórios">
          {s.labs.map((lab) => (
            <li key={lab}>
              <span className={`swatch lab-${(labIndex.get(lab) ?? 0) % LAB_COLOR_COUNT}`} aria-hidden="true" />
              {lab}
            </li>
          ))}
        </ul>
        <p className="legend-help">
          A <strong>barra</strong> atrás de cada ponto é a faixa de referência do laudo daquele laboratório.{" "}
          <span className="sym marker-in_range">●</span> dentro da faixa · <span className="sym marker-above">▲</span> acima ·{" "}
          <span className="sym marker-below">▼</span> abaixo
        </p>
      </figcaption>
    </figure>
  );
}
