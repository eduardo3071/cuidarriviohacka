import { categoryLabel, FLAG_SHORT, fmtNum, fmtPercent } from "../lib/format";
import { summarize, type Series } from "../lib/series";

const FLAG_SYMBOL = { above: "▲", below: "▼", in_range: "●", no_range: "○" } as const;
const TREND_ARROW = { up: "↑", down: "↓", flat: "→" } as const;

export interface BiomarkerListProps {
  series: Series[]; // ja ordenada (o que merece atencao primeiro)
  selected: string;
  onSelect: (biomarker: string) => void;
}

export function BiomarkerList({ series, selected, onSelect }: BiomarkerListProps) {
  return (
    <nav aria-label="Exames">
      <ul className="biomarkers">
        {series.map((s) => {
          const sum = summarize(s);
          const isSel = s.biomarker === selected;
          return (
            <li key={s.biomarker}>
              <button type="button" className={`bm${isSel ? " active" : ""}`} aria-current={isSel ? "true" : undefined} onClick={() => onSelect(s.biomarker)}>
                <span className="bm-top">
                  <span className="bm-name">{s.biomarker}</span>
                  <span className={`bm-flag marker-${sum.latest.flag}`} title={FLAG_SHORT[sum.latest.flag]}>
                    {FLAG_SYMBOL[sum.latest.flag]} {FLAG_SHORT[sum.latest.flag]}
                  </span>
                </span>
                <span className="bm-value">
                  {fmtNum(sum.latest.value)} <small>{s.unit}</small>
                </span>
                <span className="bm-sub">
                  {categoryLabel(s.category)}
                  {sum.changePct !== null && s.points.length > 1 ? (
                    <>
                      {" · "}
                      {TREND_ARROW[sum.trend]} {fmtPercent(sum.changePct)} desde {sum.first.collected_at.slice(0, 4)}
                    </>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
