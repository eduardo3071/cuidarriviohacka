import { FLAG_SHORT, fmtDate, fmtNum, fmtRange } from "../lib/format";
import { labName, pointKey, type Series } from "../lib/series";

/** Os mesmos dados do grafico em tabela: acessivel, e deixa conferir cada conversao. */
export function DataTable({ series }: { series: Series }) {
  return (
    <details className="table-wrap">
      <summary>Ver os dados em tabela</summary>
      <table>
        <caption className="sr-only">{series.biomarker}: resultados por data</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Laboratório</th>
            <th scope="col">No laudo</th>
            <th scope="col">Normalizado ({series.unit})</th>
            <th scope="col">Faixa do laudo</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {series.points.map((p) => (
            <tr key={pointKey(p)}>
              <td>{fmtDate(p.collected_at)}</td>
              <td>{labName(p)}</td>
              <td>
                {fmtNum(p.raw_value)} {p.raw_unit}
              </td>
              <td>{fmtNum(p.value)}</td>
              <td>{fmtRange(p.raw_ref_low, p.raw_ref_high, p.raw_unit) ?? "—"}</td>
              <td>{FLAG_SHORT[p.flag]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
