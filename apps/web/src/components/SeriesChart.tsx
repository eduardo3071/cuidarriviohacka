import { scaleLinear, scaleUtc } from "d3-scale";
import { fmtDate, fmtNum, FLAG_LABEL } from "../lib/format";
import { useWidth } from "../lib/useWidth";
import { chartDomain, LAB_COLOR_COUNT, labName, pointKey, rangeBar, summarize, toTime, type ChartPoint, type Series } from "../lib/series";

const DEFAULT_W = 760;
const M = { top: 36, right: 24, bottom: 40, left: 58 };
const BAR_W = 14;
const heightFor = (w: number): number => (w >= 500 ? 320 : 240);
const yearFmt = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "UTC" });

/** Uma forma por laboratório: círculo, quadrado, losango e triângulo. */
function Marker({ lab, cx, cy }: { lab: number; cx: number; cy: number }) {
  if (lab === 1) return <rect className="marker" x={cx - 5} y={cy - 5} width={10} height={10} rx={1} />;
  if (lab === 2) return <path className="marker" d={`M${cx},${cy - 6} L${cx + 6},${cy} L${cx},${cy + 6} L${cx - 6},${cy} Z`} />;
  if (lab === 3) return <path className="marker" d={`M${cx},${cy - 6} L${cx + 6},${cy + 5} L${cx - 6},${cy + 5} Z`} />;
  return <circle className="marker" cx={cx} cy={cy} r={5} />;
}

export interface SeriesChartProps {
  series: Series;
  labIndex: Map<string, number>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onOpen?: (key: string) => void;
}

export function SeriesChart({ series, labIndex, selectedKey, onSelect, onOpen }: SeriesChartProps) {
  const { points, unit, biomarker } = series;
  const [figRef, W] = useWidth(DEFAULT_W, 280);
  const H = heightFor(W);
  const d = chartDomain(points);
  const x = scaleUtc().domain([new Date(d.xMin), new Date(d.xMax)]).range([M.left, W - M.right]);
  const y = scaleLinear().domain([d.yMin, d.yMax]).range([H - M.bottom, M.top]).nice(5);
  const [yLo, yHi] = y.domain() as [number, number];
  const cx = (p: ChartPoint) => x(new Date(toTime(p.collected_at)));
  const s = summarize(series);
  const label = `${biomarker}: ${points.length} resultados de ${s.labs.length} ${s.labs.length === 1 ? "laboratório" : "laboratórios"}, de ${fmtDate(s.first.collected_at)} a ${fmtDate(s.latest.collected_at)}. A área sombreada mostra a faixa do laudo mais recente.`;
  const path = points.map((p, index) => `${index === 0 ? "M" : "L"}${cx(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const lastX = cx(s.latest);
  const lastY = y(s.latest.value);

  return (
    <figure className="chart" ref={figRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="chart-title" className="chart-svg">
        <title id="chart-title">{label}</title>
        {y.ticks(5).map((t) => <g key={`y${t}`}><line className="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} /><text className="tick" x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{fmtNum(t)}</text></g>)}
        {x.ticks(6).map((t) => <text key={`x${t.getTime()}`} className="tick" x={x(t)} y={H - M.bottom + 22} textAnchor="middle">{yearFmt.format(t)}</text>)}
        <text className="unit" x={M.left - 8} y={M.top - 20} textAnchor="end">{unit}</text>

        {s.latest.ref_low != null && s.latest.ref_high != null && <rect className="reference-band" x={M.left} y={y(s.latest.ref_high)} width={W - M.left - M.right} height={Math.max(1, y(s.latest.ref_low) - y(s.latest.ref_high))} />}
        <path className="trend" d={path} fill="none" pathLength={1} />

        {points.map((p) => {
          const key = pointKey(p);
          const bar = rangeBar(p, { yMin: yLo, yMax: yHi });
          const idx = (labIndex.get(labName(p)) ?? 0) % LAB_COLOR_COUNT;
          const px = cx(p);
          const py = y(p.value);
          const selected = key === selectedKey;
          return (
            <g key={key} className={`pt lab-${idx}${selected ? " selected" : ""}`} data-testid="point" data-flag={p.flag} data-lab={labName(p)} tabIndex={0} role="button" aria-pressed={selected} aria-label={`${fmtDate(p.collected_at)}, ${labName(p)}: ${fmtNum(p.value)} ${unit}. ${FLAG_LABEL[p.flag]}.`}
              onClick={() => { onSelect(key); onOpen?.(key); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(key); onOpen?.(key); } }}
              onFocus={() => onSelect(key)}>
              {bar && <g data-testid="range-bar" data-open-low={bar.openLow} data-open-high={bar.openHigh}>
                <rect className="range" x={px - BAR_W / 2} y={y(bar.high)} width={BAR_W} height={Math.max(1, y(bar.low) - y(bar.high))} rx={3} />
                {!bar.openHigh && <line className="cap" x1={px - BAR_W / 2 - 2} x2={px + BAR_W / 2 + 2} y1={y(bar.high)} y2={y(bar.high)} />}
                {!bar.openLow && <line className="cap" x1={px - BAR_W / 2 - 2} x2={px + BAR_W / 2 + 2} y1={y(bar.low)} y2={y(bar.low)} />}
              </g>}
              {(p.flag === "above" || p.flag === "below") && <circle className={`point-state-ring ring-${p.flag}`} cx={px} cy={py} r={9} />}
              {selected && <circle className="selection-ring" cx={px} cy={py} r={13} />}
              <Marker lab={idx} cx={px} cy={py} />
              <circle className="hit" cx={px} cy={py} r={22} />
            </g>
          );
        })}
        <text className="last-label" x={lastX - 12} y={lastY < 58 ? lastY + 26 : lastY - 14} textAnchor="end">{fmtNum(s.latest.value)} {unit}</text>
      </svg>

      <figcaption className="legend">
        <ul className="labs" aria-label="Laboratórios">{s.labs.map((lab) => {
          const index = (labIndex.get(lab) ?? 0) % LAB_COLOR_COUNT;
          return <li key={lab}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><Marker lab={index} cx={8} cy={8} /></svg>{lab}</li>;
        })}</ul>
        <p className="legend-help">A <strong>área sombreada</strong> é a faixa do laudo mais recente. As formas identificam os laboratórios; anéis marcam resultados fora da faixa. Toque em um ponto para ver o detalhe.</p>
      </figcaption>
    </figure>
  );
}
