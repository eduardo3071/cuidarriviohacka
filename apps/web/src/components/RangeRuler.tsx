import type { Flag } from "../types";

const ICON: Record<Flag, string> = { above: "▲", below: "▼", in_range: "✓", no_range: "–" };
const TEXT: Record<Flag, string> = {
  above: "acima da faixa do laudo",
  below: "abaixo da faixa do laudo",
  in_range: "dentro da faixa do laudo",
  no_range: "laudo sem faixa",
};

/** Régua da faixa: faixa impressa no próprio laudo sombreada + ponto onde o valor está. */
export function RangeRuler({ value, low, high, unit, flag }: { value: number; low: number | null; high: number | null; unit: string; flag: Flag }) {
  let pos: number | null = null;
  let band: [number, number] | null = null;
  if (low != null || high != null) {
    const lo = low ?? Math.min(value, high!) * 0.5;
    const hi = high ?? Math.max(value, lo) * 1.5 + 1;
    const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1e-6);
    const min = Math.min(lo - span * 0.5, value);
    const max = Math.max(hi + span * 0.5, value);
    const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;
    band = [low != null ? pct(low) : 0, high != null ? pct(high) : 100];
    pos = Math.min(98, Math.max(2, pct(value)));
  }
  return (
    <span className={`ruler state-${flag}`}>
      <span className="ruler-track" aria-hidden="true" title={`${value} ${unit}`}>
        {band && <span className="ruler-band" style={{ left: `${band[0]}%`, width: `${band[1] - band[0]}%` }} />}
        {pos != null && <span className="ruler-dot" style={{ left: `${pos}%` }} />}
      </span>
      <span className="ruler-label">
        <span aria-hidden="true">{ICON[flag]}</span> {TEXT[flag]}
      </span>
    </span>
  );
}
