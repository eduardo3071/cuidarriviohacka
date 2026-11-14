import { fmtDate, fmtNum } from "../lib/format";
import { labName, pointKey, type Series } from "../lib/series";
import { StateChip } from "./StateChip";

/** Os mesmos dados do gráfico: cartões no celular, tabela no computador. */
export function DataTable({ series, onOpen, selectedKey }: { series: Series; onOpen?: (key: string) => void; selectedKey?: string | null }) {
  const pts = [...series.points].reverse();
  return (
    <section className="result-cards" aria-label={`${series.biomarker}: resultados em lista`}>
      <h3 className="list-title">Todos os resultados<span className="sr-only"> — Resultados em lista</span></h3>
      <ul className="rc-list">
        {pts.map((p) => {
          const key = pointKey(p);
          const converted = p.normalization === "converted";
          const body = (
            <>
              <span className="rc-top"><span className="rc-date">{fmtDate(p.collected_at)}</span><span className="rc-lab">{labName(p)}</span></span>
              <span className="rc-sub">No laudo: {fmtNum(p.raw_value)} {p.raw_unit}{converted && <> · <strong>= {fmtNum(p.value)} {series.unit}</strong></>}</span>
              <StateChip flag={p.flag} short />
            </>
          );
          return <li key={key}>{onOpen ? <button type="button" className="rc" onClick={() => onOpen(key)}>{body}</button> : <div className="rc">{body}</div>}</li>;
        })}
      </ul>
      <div className="rt-wrap">
        <table className="rt">
          <thead><tr><th scope="col">Data</th><th scope="col">Laboratório</th><th scope="col">No laudo</th><th scope="col">Convertido</th><th scope="col">Estado</th></tr></thead>
          <tbody>
            {pts.map((p) => {
              const key = pointKey(p);
              return (
                <tr key={key} className={key === selectedKey ? "is-selected" : undefined} onClick={onOpen ? () => onOpen(key) : undefined}>
                  <td>{onOpen ? <button type="button" className="rt-open" onClick={(e) => { e.stopPropagation(); onOpen(key); }}>{fmtDate(p.collected_at)}</button> : fmtDate(p.collected_at)}</td>
                  <td>{labName(p)}</td>
                  <td>{fmtNum(p.raw_value)} {p.raw_unit}</td>
                  <td>{fmtNum(p.value)} {series.unit}</td>
                  <td><StateChip flag={p.flag} short /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
