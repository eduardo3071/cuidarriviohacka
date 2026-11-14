import { Bell, CalendarCheck, FlaskConical, Pill, Syringe, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { describeEvent, eventDateLabel, groupByYear, KIND_LABEL } from "../lib/timeline";
import type { EventKind, TimelineEvent } from "../types";
import { Sheet } from "./Sheet";
import "./phase3.css";

export interface TimelineProps {
  events: TimelineEvent[];
  hidden: ReadonlySet<EventKind>;
  onToggle: (kind: EventKind) => void;
  /** Controle de abas exibido ao lado dos filtros no computador. */
  tabs?: React.ReactNode;
}

/** Filtros da tela: "Remédio" junta início e fim de medicação. */
const FILTERS: { label: string; kinds: EventKind[] }[] = [
  { label: "Exame", kinds: ["exam"] },
  { label: "Consulta", kinds: ["encounter"] },
  { label: "Remédio", kinds: ["medication_start", "medication_end"] },
  { label: "Vacina", kinds: ["vaccine"] },
  { label: "Alerta", kinds: ["alert"] },
];

const ICON: Record<EventKind, LucideIcon> = {
  exam: FlaskConical, encounter: CalendarCheck, medication_start: Pill, medication_end: Pill, vaccine: Syringe, alert: Bell,
};

export function Timeline({ events, hidden, onToggle, tabs }: TimelineProps) {
  const [open, setOpen] = useState<TimelineEvent | null>(null);
  const shown = events.filter((e) => !hidden.has(e.kind));
  const groups = groupByYear(shown);
  return (
    <section aria-label="Linha do tempo" className="tl">
      <div className="tl-bar">
        {tabs}
        <div className="tl-filters" role="group" aria-label="Tipos de evento">
          {FILTERS.map((f) => {
            const on = !hidden.has(f.kinds[0]!);
            return (
              <button key={f.label} type="button" className="filter-chip" aria-pressed={on}
                onClick={() => f.kinds.forEach((k) => { if (hidden.has(k) !== !on) return; onToggle(k); })}>
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="muted">Nenhum evento para os tipos escolhidos.</p>
      ) : (
        groups.map((g) => (
          <div key={g.year} className="tl-year">
            <h3 className="tl-year-h">{g.year}</h3>
            <ol className="tl-list">
              {g.events.map((e, i) => {
                const Icon = ICON[e.kind];
                const detail = describeEvent(e);
                return (
                  <li key={`${e.event_date}|${e.kind}|${e.title}|${i}`} className={`tl-ev${e.kind === "alert" ? " is-alert" : ""}`} data-testid="event">
                    <span className="tl-dot" aria-hidden="true" />
                    <button type="button" className="tl-card" onClick={() => setOpen(e)}>
                      <span className="tl-row">
                        <span className="tl-kind"><Icon size={20} strokeWidth={1.75} aria-hidden="true" />{KIND_LABEL[e.kind]}</span>
                        <span className="tl-date">{eventDateLabel(e)}</span>
                      </span>
                      <span className="tl-title">{e.title}</span>
                      {detail && <span className="tl-detail">{detail}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}
      <Sheet open={open !== null} title={open?.title ?? ""} onClose={() => setOpen(null)}>
        {open && (
          <dl className="ev-sheet">
            <div><dt>Tipo</dt><dd>{KIND_LABEL[open.kind]}</dd></div>
            <div><dt>Data</dt><dd>{eventDateLabel(open)}</dd></div>
            {describeEvent(open) && <div><dt>Detalhe</dt><dd>{describeEvent(open)}</dd></div>}
          </dl>
        )}
      </Sheet>
    </section>
  );
}
