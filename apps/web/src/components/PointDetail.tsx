import { fmtDate, fmtNum } from "../lib/format";
import { labName, type ChartPoint } from "../lib/series";
import { RangeRuler } from "./RangeRuler";
import { rangeText, StateChip } from "./StateChip";

/** O que o laudo disse, lado a lado com o valor convertido e a faixa impressa no laudo. */
export function PointDetail({ p }: { p: ChartPoint }) {
  const printed = p.ref_text ?? rangeText(p.raw_ref_low, p.raw_ref_high);
  return (
    <section className="detail" aria-live="polite" aria-label="Detalhe do resultado selecionado">
      <dl className="pairs">
        <div><dt>Data da coleta</dt><dd>{fmtDate(p.collected_at)}</dd></div>
        <div><dt>Valor no laudo</dt><dd>{fmtNum(p.raw_value)}</dd></div>
        <div><dt>Unidade no laudo</dt><dd>{p.raw_unit ?? "não informada"}</dd></div>
        <div><dt>Valor convertido</dt><dd>{fmtNum(p.value)} {p.unit_canonical}</dd></div>
        <div><dt>Laboratório</dt><dd>{labName(p)}</dd></div>
        <div><dt>Nome no laudo</dt><dd>{p.raw_name}</dd></div>
        <div><dt>Faixa impressa no laudo</dt><dd>{printed ? `${printed}${p.raw_unit && !p.ref_text ? ` ${p.raw_unit}` : ""}` : "não informada"}</dd></div>
      </dl>
      <RangeRuler value={p.value} low={p.ref_low} high={p.ref_high} unit={p.unit_canonical} flag={p.flag} showLabel={false} />
      <StateChip flag={p.flag} />
    </section>
  );
}
