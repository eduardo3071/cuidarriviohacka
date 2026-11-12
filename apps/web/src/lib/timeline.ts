import type { EventKind, TimelineEvent } from "../types";
import { fmtDate } from "./format";

export const KIND_LABEL: Record<EventKind, string> = {
  exam: "Exame",
  encounter: "Consulta",
  medication_start: "Início de medicação",
  medication_end: "Fim de medicação",
  vaccine: "Vacina",
  alert: "Alerta do relógio",
};

export const KINDS = Object.keys(KIND_LABEL) as EventKind[];

export interface YearGroup {
  year: string;
  events: TimelineEvent[];
}

/** Anos do mais recente para o mais antigo; dentro do ano, do mais recente para o mais antigo. */
export function groupByYear(events: TimelineEvent[]): YearGroup[] {
  const by = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const year = e.event_date.slice(0, 4);
    by.set(year, [...(by.get(year) ?? []), e]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, list]) => ({
      year,
      events: [...list].sort((a, b) => b.event_date.localeCompare(a.event_date) || a.title.localeCompare(b.title)),
    }));
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** Texto de apoio do evento, a partir do detalhe. Nao inventa: sem dado, sem texto. */
export function describeEvent(e: TimelineEvent): string | null {
  switch (e.kind) {
    case "exam": {
      const n = num(e.detail.results);
      const out = num(e.detail.out_of_range) ?? 0;
      if (n === null) return null;
      const base = `${n} ${n === 1 ? "resultado" : "resultados"}`;
      return out > 0 ? `${base} · ${out} fora da faixa do laudo` : `${base} · todos na faixa do laudo`;
    }
    case "encounter":
      return [str(e.detail.provider), str(e.detail.notes)].filter(Boolean).join(" — ") || null;
    case "medication_start":
    case "medication_end":
      return str(e.detail.dose);
    case "vaccine": {
      const d = num(e.detail.dose_number);
      return d === null ? null : `Dose ${d}`;
    }
    case "alert": {
      const sev = str(e.detail.severity);
      return sev === "urgent" ? "Urgente" : sev === "attention" ? "Atenção" : sev === "info" ? "Informativo" : null;
    }
  }
}

export const eventDateLabel = (e: TimelineEvent): string => fmtDate(e.event_date).slice(0, 5); // dd/mm
