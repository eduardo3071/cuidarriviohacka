import { AlertCircle, Check } from "lucide-react";
import { useState } from "react";
import type { Review } from "../data/documents";
import { needsAttention, parseNumber, type Draft, type DraftRow } from "../lib/review";
import { SAFETY_COPY } from "../lib/safetyCopy";
import type { Flag } from "../types";
import { RangeRuler } from "./RangeRuler";
import { Sheet } from "./Sheet";
import { StateChip } from "./StateChip";
import { Button, Input } from "./ui";
import "./upload.css";

const METHOD_LABEL: Record<string, string> = { text_layer: "texto do PDF", ocr: "leitura da imagem (OCR)", llm: "IA", manual: "editado por você" };

export interface ReviewFormProps {
  review: Review;
  draft: Draft;
  onChange: (next: Draft) => void;
  errors: string[];
  rowErrors: Record<number, string>;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Estado só para a régua: compara com a faixa digitada, que é a do próprio laudo. */
function flagOf(v: number | null, lo: number | null, hi: number | null): Flag {
  if (v === null || (lo === null && hi === null)) return "no_range";
  if (lo !== null && v < lo) return "below";
  if (hi !== null && v > hi) return "above";
  return "in_range";
}
const rangeLabel = (lo: string, hi: string) => (lo.trim() && hi.trim() ? `faixa ${lo} a ${hi}` : lo.trim() ? `faixa a partir de ${lo}` : hi.trim() ? `faixa até ${hi}` : "sem faixa no laudo");

type Edit = Pick<DraftRow, "raw_name" | "value" | "unit" | "ref_low" | "ref_high">;

/** Revisão do que a extração leu: a pessoa confere cada valor contra a imagem do laudo antes de ir para o histórico. */
export function ReviewForm({ review, draft, onChange, errors, rowErrors, busy, onConfirm, onCancel }: ReviewFormProps) {
  const [focus, setFocus] = useState<number | null>(null);
  const [showPage, setShowPage] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ id: number; v: Edit } | null>(null);
  const setRow = (id: number, patch: Partial<DraftRow>) => onChange({ ...draft, rows: draft.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const focused = draft.rows.find((r) => r.id === focus) ?? draft.rows[0];
  const included = draft.rows.filter((r) => r.include).length;
  const attention = draft.rows.filter((r) => needsAttention(r.original)).length;
  const sheetRow = draft.rows.find((r) => r.id === showPage);

  const pageView = (row: DraftRow | undefined) => {
    const page = row ? review.pages.find((p) => p.page === row.original.page) : undefined;
    const bbox = row?.original.bbox ?? null;
    return page ? (
      <>
        <div className="rv-page">
          <img src={page.url} alt={`Página ${page.page} do laudo enviado`} />
          {bbox && <div className="bbox" aria-hidden="true" style={{ left: `${bbox[0] * 100}%`, top: `${bbox[1] * 100}%`, width: `${(bbox[2] - bbox[0]) * 100}%`, height: `${(bbox[3] - bbox[1]) * 100}%` }} />}
        </div>
        {row && bbox && <p className="caption">O quadro marca onde “{row.original.raw_name}” foi lido.</p>}
      </>
    ) : (
      <p className="caption">A imagem do laudo não está disponível. Confira os valores no papel.</p>
    );
  };

  return (
    <div className="rv">
      <div className="rv-main">
        <h3 className="page-title rv-title">Confira o que foi lido</h3>
        <p className="rv-lead">{SAFETY_COPY.upload}</p>
        <p className="caption">Leitura feita por {METHOD_LABEL[review.method] ?? review.method}. Corrija o que estiver diferente do papel e desmarque o que não quiser guardar.</p>
        {attention > 0 && (
          <p role="note" className="rv-attn">
            <AlertCircle size={20} strokeWidth={1.75} aria-hidden="true" />
            {attention === 1 ? "1 resultado merece" : `${attention} resultados merecem`} uma conferência extra (baixa confiança ou ajuste automático).
          </p>
        )}
        {review.warnings.length > 0 && <ul className="rv-warn">{review.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

        <div className="rv-meta">
          <Input id="lab" label="Laboratório" type="text" value={draft.labName} maxLength={120} onChange={(e) => onChange({ ...draft, labName: e.target.value })} />
          <Input id="collected" label="Data da coleta" type="date" value={draft.collectedAt} required onChange={(e) => onChange({ ...draft, collectedAt: e.target.value })} />
        </div>

        <h4 className="sec-title">Resultados lidos ({draft.rows.length})</h4>
        <ul className="rv-list" aria-label="Resultados lidos do laudo">
          {draft.rows.map((r) => {
            const err = rowErrors[r.id];
            const id = `r${r.id}`;
            const v = parseNumber(r.value), lo = parseNumber(r.ref_low), hi = parseNumber(r.ref_high);
            const flag = flagOf(v, lo, hi);
            return (
              <li key={r.id} className={["rc", focused?.id === r.id ? "is-focus" : "", err ? "is-error" : "", r.include ? "" : "is-off"].join(" ").trim()}
                onFocus={() => setFocus(r.id)} onClick={() => setFocus(r.id)}>
                <div className="rc-top">
                  <label className="rc-check">
                    <input type="checkbox" aria-label={`Guardar ${r.original.raw_name}`} checked={r.include} onChange={(e) => setRow(r.id, { include: e.target.checked })} />
                    <span className="rc-box" aria-hidden="true"><Check size={16} strokeWidth={2.5} /></span>
                  </label>
                  <span className="rc-name">{r.raw_name || r.original.raw_name}</span>
                  {needsAttention(r.original) && <span className="rc-attn" title={r.original.notes.join("; ") || "confiança baixa"}>conferir</span>}
                </div>
                <div className="rc-val">
                  <span><strong>{r.value || "—"}</strong> <span className="caption">{r.unit}</span></span>
                  <span className="caption">{rangeLabel(r.ref_low, r.ref_high)}</span>
                </div>
                <div className="rc-fields">
                  <label className="sr-only" htmlFor={`${id}-n`}>Nome do exame</label>
                  <input id={`${id}-n`} className="f-name" type="text" aria-label={`Nome do exame ${r.id + 1}`} value={r.raw_name} onChange={(e) => setRow(r.id, { raw_name: e.target.value })} />
                  <input className="f-num" type="text" inputMode="decimal" aria-label={`Valor de ${r.original.raw_name}`} value={r.value} onChange={(e) => setRow(r.id, { value: e.target.value })} />
                  <input className="f-num" type="text" aria-label={`Unidade de ${r.original.raw_name}`} value={r.unit} onChange={(e) => setRow(r.id, { unit: e.target.value })} />
                  <input className="f-ref" type="text" inputMode="decimal" aria-label={`Mínimo de ${r.original.raw_name}`} placeholder="mín." value={r.ref_low} onChange={(e) => setRow(r.id, { ref_low: e.target.value })} />
                  <input className="f-ref" type="text" inputMode="decimal" aria-label={`Máximo de ${r.original.raw_name}`} placeholder="máx." value={r.ref_high} onChange={(e) => setRow(r.id, { ref_high: e.target.value })} />
                </div>
                {v !== null && <RangeRuler value={v} low={lo} high={hi} unit={r.unit} flag={flag} showLabel={false} />}
                <div className="rc-foot">
                  <StateChip flag={flag} short />
                  <span className="rc-links">
                    <button type="button" className="rc-link" onClick={() => setEdit({ id: r.id, v: { raw_name: r.raw_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high } })}>Editar</button>
                    <button type="button" className="rc-link" onClick={() => setShowPage(r.id)}>Ver no laudo</button>
                  </span>
                </div>
                {err && <p role="alert" className="rc-err"><AlertCircle size={16} strokeWidth={2} aria-hidden="true" />{err}</p>}
              </li>
            );
          })}
        </ul>

        {errors.length > 0 && (
          <ul role="alert" className="rv-errors">{errors.map((e) => <li key={e}><AlertCircle size={16} strokeWidth={2} aria-hidden="true" />{e}</li>)}</ul>
        )}
        <div className="rv-bar">
          <Button disabled={busy || included === 0} onClick={onConfirm}>
            {busy ? "Guardando…" : `Guardar ${included} ${included === 1 ? "resultado" : "resultados"} no meu histórico`}
          </Button>
          <Button variant="link" disabled={busy} onClick={onCancel}>Descartar</Button>
        </div>
      </div>

      <aside className="ds-card rv-side" aria-label="Imagem do laudo">{pageView(focused)}</aside>

      <Sheet open={sheetRow !== undefined} title="Ver no laudo" onClose={() => setShowPage(null)}>{pageView(sheetRow)}</Sheet>
      <Sheet open={edit !== null} title="Editar resultado" onClose={() => setEdit(null)}>
        {edit && (
          <form className="rv-edit" onSubmit={(e) => { e.preventDefault(); setRow(edit.id, edit.v); setEdit(null); }}>
            <Input label="Nome" value={edit.v.raw_name} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, raw_name: e.target.value } })} />
            <Input label="Valor" inputMode="decimal" value={edit.v.value} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, value: e.target.value } })} />
            <Input label="Unidade" value={edit.v.unit} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, unit: e.target.value } })} />
            <Input label="Mínimo da faixa do laudo" inputMode="decimal" value={edit.v.ref_low} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, ref_low: e.target.value } })} />
            <Input label="Máximo da faixa do laudo" inputMode="decimal" value={edit.v.ref_high} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, ref_high: e.target.value } })} />
            <Button type="submit">Salvar</Button>
            <Button variant="link" onClick={() => setEdit(null)}>Cancelar</Button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
