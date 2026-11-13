import type { ConfirmObservation, ConfirmPayload, Review, ReviewObservation } from "../data/documents";

/** Uma linha da tela de revisao. Os campos editaveis ficam como TEXTO (e o que a pessoa digita); a conversao e validada em buildConfirm. */
export interface DraftRow {
  id: number;
  include: boolean;
  raw_name: string;
  value: string;
  unit: string;
  ref_low: string;
  ref_high: string;
  original: ReviewObservation;
}
export interface Draft {
  labName: string;
  collectedAt: string; // yyyy-mm-dd ou vazio
  rows: DraftRow[];
}

const fmt = (n: number | null): string => (n === null ? "" : String(n));

export function toDraft(review: Review): Draft {
  return {
    labName: review.lab_name ?? "",
    collectedAt: review.collected_at ?? "",
    rows: review.observations.map((o, id) => ({
      id,
      include: true,
      raw_name: o.raw_name,
      value: String(o.value),
      unit: o.unit ?? "",
      ref_low: fmt(o.ref_low),
      ref_high: fmt(o.ref_high),
      original: o,
    })),
  };
}

/** "5,4" e "5.4" valem; texto, vazio e infinito nao. Nao aceita milhar ("1.234,5" e ambiguo: peca para digitar sem separador). */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Leitura que merece um olhar a mais: confianca baixa do OCR ou correcao automatica aplicada. */
export function needsAttention(o: ReviewObservation): boolean {
  return (o.confidence !== null && o.confidence < 0.8) || o.notes.length > 0;
}

export type BuildResult =
  | { ok: true; payload: ConfirmPayload }
  | { ok: false; errors: string[]; rowErrors: Record<number, string> };

const sameNumber = (text: string, n: number | null) => (text.trim() === "" ? n === null : parseNumber(text) === n);

/** Valida o rascunho e monta o corpo de /confirm. Isto vai para o historico clinico: na duvida, recusa e diz o que corrigir. */
export function buildConfirm(draft: Draft, today: Date = new Date()): BuildResult {
  const errors: string[] = [];
  const rowErrors: Record<number, string> = {};

  const date = draft.collectedAt.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) errors.push("Informe a data da coleta (dia/mês/ano).");
  else if (date < "1900-01-01" || date > today.toISOString().slice(0, 10)) errors.push("A data da coleta não pode ser no futuro nem anterior a 1900.");

  const included = draft.rows.filter((r) => r.include);
  if (included.length === 0) errors.push("Marque pelo menos um resultado para guardar.");
  if (included.length > 200) errors.push("São resultados demais de uma vez (máximo 200).");

  const observations: ConfirmObservation[] = [];
  for (const r of included) {
    const bad = (m: string) => {
      rowErrors[r.id] = m;
    };
    const name = r.raw_name.trim();
    const value = parseNumber(r.value);
    const low = r.ref_low.trim() === "" ? null : parseNumber(r.ref_low);
    const high = r.ref_high.trim() === "" ? null : parseNumber(r.ref_high);
    if (!name) bad("Falta o nome do exame.");
    else if (value === null) bad("O valor precisa ser um número.");
    else if (r.ref_low.trim() !== "" && low === null) bad("Limite inferior inválido.");
    else if (r.ref_high.trim() !== "" && high === null) bad("Limite superior inválido.");
    else if (low !== null && high !== null && low > high) bad("O limite inferior é maior que o superior.");
    if (rowErrors[r.id] !== undefined) continue;

    const o = r.original;
    const edited =
      name !== o.raw_name.trim() ||
      value !== o.value ||
      r.unit.trim() !== (o.unit ?? "") ||
      !sameNumber(r.ref_low, o.ref_low) ||
      !sameNumber(r.ref_high, o.ref_high);
    observations.push({
      raw_name: name,
      // nome mudou: o biomarcador resolvido deixa de valer, e o servidor resolve de novo pelo nome
      canonical_name: name === o.raw_name.trim() ? o.canonical_name : null,
      value: value as number,
      unit: r.unit.trim() || null,
      ref_low: low,
      ref_high: high,
      ref_text: edited ? null : o.ref_text,
      confidence: o.confidence,
      page: o.page,
      bbox: o.bbox,
      method: edited ? "manual" : (o.method ?? "manual"),
      notes: o.notes,
    });
  }
  if (Object.keys(rowErrors).length > 0) errors.push("Corrija os resultados marcados em vermelho.");
  if (errors.length > 0) return { ok: false, errors, rowErrors };
  return { ok: true, payload: { collected_at: date, lab_name: draft.labName.trim() || null, observations } };
}
