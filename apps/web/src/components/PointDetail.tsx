import { FLAG_LABEL, fmtDate, fmtNum, fmtRange } from "../lib/format";
import { labName, type ChartPoint } from "../lib/series";

/** O que o laudo disse, lado a lado com o valor normalizado e as duas faixas (a do laudo e a convertida). */
export function PointDetail({ p }: { p: ChartPoint }) {
  const converted = p.normalization === "converted";
  const rawRange = p.ref_text ? `${p.ref_text}${p.raw_unit ? ` ${p.raw_unit}` : ""}` : fmtRange(p.raw_ref_low, p.raw_ref_high, p.raw_unit);
  const normRange = fmtRange(p.ref_low, p.ref_high, p.unit_canonical);
  return (
    <section className="detail" aria-live="polite" aria-label="Detalhe do resultado selecionado">
      <p className={`chip flag-${p.flag}`}>{FLAG_LABEL[p.flag]}</p>
      <dl>
        <div>
          <dt>Data da coleta</dt>
          <dd>{fmtDate(p.collected_at)}</dd>
        </div>
        <div>
          <dt>Laboratório</dt>
          <dd>{labName(p)}</dd>
        </div>
        <div>
          <dt>Nome no laudo</dt>
          <dd>{p.raw_name}</dd>
        </div>
        <div>
          <dt>Resultado no laudo</dt>
          <dd>
            {fmtNum(p.raw_value)} {p.raw_unit}
          </dd>
        </div>
        {converted && (
          <div>
            <dt>Normalizado</dt>
            <dd>
              {fmtNum(p.value)} {p.unit_canonical}
            </dd>
          </div>
        )}
        <div>
          <dt>Faixa do laudo</dt>
          <dd>
            {rawRange ?? "não informada"}
            {converted && normRange ? <span className="muted"> (= {normRange})</span> : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
