import { useState } from "react";
import type { Review } from "../data/documents";
import { needsAttention, type Draft, type DraftRow } from "../lib/review";

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

/** Revisao do que a extracao leu: a pessoa confere cada valor contra a imagem do laudo antes de ir para o historico. */
export function ReviewForm({ review, draft, onChange, errors, rowErrors, busy, onConfirm, onCancel }: ReviewFormProps) {
  const [focus, setFocus] = useState<number | null>(null);
  const setRow = (id: number, patch: Partial<DraftRow>) => onChange({ ...draft, rows: draft.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const focused = draft.rows.find((r) => r.id === focus) ?? draft.rows[0];
  const page = focused ? review.pages.find((p) => p.page === focused.original.page) : undefined;
  const bbox = focused?.original.bbox ?? null;
  const included = draft.rows.filter((r) => r.include).length;
  const attention = draft.rows.filter((r) => needsAttention(r.original)).length;

  return (
    <div className="review">
      <section className="panel">
        <h2>Confira o que foi lido</h2>
        <p className="muted">
          Leitura feita por {METHOD_LABEL[review.method] ?? review.method}. Nada vai para o seu histórico até você confirmar. Corrija o que estiver
          diferente do papel e desmarque o que não quiser guardar.
        </p>
        {attention > 0 && (
          <p role="note" className="attention-note">
            ▲ {attention === 1 ? "1 resultado merece" : `${attention} resultados merecem`} uma conferência extra (baixa confiança ou ajuste automático).
          </p>
        )}
        {review.warnings.length > 0 && (
          <ul className="warnings">
            {review.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <div className="review-meta">
          <label htmlFor="lab">Laboratório</label>
          <input id="lab" type="text" value={draft.labName} maxLength={120} onChange={(e) => onChange({ ...draft, labName: e.target.value })} />
          <label htmlFor="collected">Data da coleta</label>
          <input id="collected" type="date" value={draft.collectedAt} onChange={(e) => onChange({ ...draft, collectedAt: e.target.value })} required />
        </div>

        <ul className="review-cards" aria-label="Resultados lidos do laudo">
          {draft.rows.map((r) => {
            const err = rowErrors[r.id];
            const id = `r${r.id}`;
            return (
              <li
                key={r.id}
                className={["rcard", focused?.id === r.id ? "focused" : "", err ? "row-error" : "", r.include ? "" : "excluded"].join(" ").trim()}
                onFocus={() => setFocus(r.id)}
                onClick={() => setFocus(r.id)}
              >
                <label className="check big">
                  <input type="checkbox" aria-label={`Guardar ${r.original.raw_name}`} checked={r.include} onChange={(e) => setRow(r.id, { include: e.target.checked })} />
                  <span>Guardar</span>
                  {needsAttention(r.original) && (
                    <span className="chip attn" title={r.original.notes.join("; ") || "confiança baixa"}>
                      ▲ conferir
                    </span>
                  )}
                </label>
                <div className="field">
                  <label htmlFor={`${id}-n`}>Nome do exame</label>
                  <input id={`${id}-n`} type="text" aria-label={`Nome do exame ${r.id + 1}`} value={r.raw_name} onChange={(e) => setRow(r.id, { raw_name: e.target.value })} />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor={`${id}-v`}>Valor</label>
                    <input id={`${id}-v`} type="text" inputMode="decimal" aria-label={`Valor de ${r.original.raw_name}`} value={r.value} onChange={(e) => setRow(r.id, { value: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-u`}>Unidade</label>
                    <input id={`${id}-u`} type="text" aria-label={`Unidade de ${r.original.raw_name}`} value={r.unit} onChange={(e) => setRow(r.id, { unit: e.target.value })} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor={`${id}-lo`}>Mínimo da faixa do laudo</label>
                    <input id={`${id}-lo`} type="text" inputMode="decimal" aria-label={`Mínimo de ${r.original.raw_name}`} value={r.ref_low} onChange={(e) => setRow(r.id, { ref_low: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-hi`}>Máximo da faixa do laudo</label>
                    <input id={`${id}-hi`} type="text" inputMode="decimal" aria-label={`Máximo de ${r.original.raw_name}`} value={r.ref_high} onChange={(e) => setRow(r.id, { ref_high: e.target.value })} />
                  </div>
                </div>
                {err && (
                  <div role="alert" className="form-error">
                    {err}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {errors.length > 0 && (
          <ul role="alert" className="form-error errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="actions sticky-action">
          <button type="button" className="primary" disabled={busy || included === 0} onClick={onConfirm}>
            {busy ? "Guardando…" : `Guardar ${included} ${included === 1 ? "resultado" : "resultados"} no meu histórico`}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
            Descartar e voltar
          </button>
        </div>
      </section>

      <aside className="panel page-view" aria-label="Imagem do laudo">
        <h2>Laudo enviado</h2>
        {page ? (
          <div className="page-frame">
            <img src={page.url} alt={`Página ${page.page} do laudo enviado`} />
            {bbox && <div className="bbox" aria-hidden="true" style={{ left: `${bbox[0] * 100}%`, top: `${bbox[1] * 100}%`, width: `${(bbox[2] - bbox[0]) * 100}%`, height: `${(bbox[3] - bbox[1]) * 100}%` }} />}
          </div>
        ) : (
          <p className="muted">A imagem do laudo não está disponível. Confira os valores no papel.</p>
        )}
        {focused && bbox && <p className="muted">O quadro marca onde “{focused.original.raw_name}” foi lido.</p>}
      </aside>
    </div>
  );
}
