import { ChevronRight } from "lucide-react";
import { categoryLabel, fmtDate, fmtNum } from "../lib/format";
import { summarize, type Series } from "../lib/series";
import { RangeRuler } from "./RangeRuler";
import { StateChip } from "./StateChip";

export interface BiomarkerListProps {
  series: Series[]; // ja ordenada (o que merece atencao primeiro)
  selected: string;
  onSelect: (biomarker: string) => void;
  /** Agrupa por categoria (tela Exames). */
  grouped?: boolean;
}

export function BiomarkerList({ series, selected, onSelect, grouped = false }: BiomarkerListProps) {
  const groups = new Map<string, Series[]>();
  for (const s of series) {
    const k = grouped ? categoryLabel(s.category) : "";
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return (
    <nav aria-label="Exames">
      {[...groups.entries()].map(([cat, items]) => (
        <div className="bm-group" key={cat || "all"}>
          {cat && <p className="bm-cat">{cat}</p>}
          <ul className="biomarkers">
            {items.map((s) => {
              const { latest } = summarize(s);
              const isSel = s.biomarker === selected;
              return (
                <li key={s.biomarker}>
                  <button type="button" className={`bm${isSel ? " active" : ""}`} aria-current={isSel ? "true" : undefined} onClick={() => onSelect(s.biomarker)}>
                    <span className="bm-top">
                      <span className="bm-name">{s.biomarker}</span>
                      <span className="bm-value">{fmtNum(latest.value)} <small>{s.unit}</small></span>
                      <ChevronRight className="bm-chev" size={20} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="bm-value bm-value-m">{fmtNum(latest.value)} <small>{s.unit}</small></span>
                    <span className="bm-sub">{categoryLabel(s.category)} · {fmtDate(latest.collected_at)}</span>
                    <RangeRuler value={latest.value} low={latest.ref_low} high={latest.ref_high} unit={s.unit} flag={latest.flag} showLabel={false} />
                    <span className="bm-foot"><StateChip flag={latest.flag} short /><span className="bm-date">{fmtDate(latest.collected_at)}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
