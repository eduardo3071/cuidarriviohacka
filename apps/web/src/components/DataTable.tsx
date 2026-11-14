import { FLAG_SHORT, fmtDate, fmtNum, fmtRange } from "../lib/format";
import { labName, pointKey, type Series } from "../lib/series";

const FLAG_SYMBOL = { above: "▲", below: "▼", in_range: "●", no_range: "○" } as const;

/** Os mesmos dados do grafico em lista de cartoes (um por resultado): acessivel e cabe no celular. */
export function DataTable({ series, onOpen }: { series: Series; onOpen?: (key: string) => void }) {
  return (
    <section className="result-cards" aria-label={`${series.biomarker}: resultados em lista`}>
      <h3 className="list-title">Resultados em lista</h3>
      <ul>
        {[...series.points].reverse().map((p) => {
          const key = pointKey(p);
          const body = (
            <>
              <span className="rc-top">
                <span className="rc-date">{fmtDate(p.collected_at)}</span>
                <span className={`bm-flag marker-${p.flag}`}>
                  <span aria-hidden="true">{FLAG_SYMBOL[p.flag]}</span> {FLAG_SHORT[p.flag]}
                </span>
              </span>
              <span className="rc-value">
                {fmtNum(p.value)} <small>{series.unit}</small>
              </span>
              <span className="rc-sub">
                {labName(p)} · no laudo: {fmtNum(p.raw_value)} {p.raw_unit} · faixa do laudo: {fmtRange(p.raw_ref_low, p.raw_ref_high, p.raw_unit) ?? "não informada"}
              </span>
            </>
          );
          return (
            <li key={key}>
              {onOpen ? (
                <button type="button" className="rc" onClick={() => onOpen(key)}>
                  {body}
                </button>
              ) : (
                <div className="rc">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
