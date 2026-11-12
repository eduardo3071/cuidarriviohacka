import { describeEvent, eventDateLabel, groupByYear, KIND_LABEL, KINDS } from "../lib/timeline";
import type { EventKind, TimelineEvent } from "../types";

export interface TimelineProps {
  events: TimelineEvent[];
  hidden: ReadonlySet<EventKind>;
  onToggle: (kind: EventKind) => void;
}

export function Timeline({ events, hidden, onToggle }: TimelineProps) {
  const shown = events.filter((e) => !hidden.has(e.kind));
  const groups = groupByYear(shown);
  return (
    <section aria-label="Linha do tempo" className="timeline">
      <div className="filters" role="group" aria-label="Tipos de evento">
        {KINDS.map((k) => (
          <button key={k} type="button" className={`filter kind-${k}`} aria-pressed={!hidden.has(k)} onClick={() => onToggle(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="muted">Nenhum evento para os tipos escolhidos.</p>
      ) : (
        groups.map((g) => (
          <div key={g.year} className="year">
            <h3>{g.year}</h3>
            <ol>
              {g.events.map((e, i) => (
                <li key={`${e.event_date}|${e.kind}|${e.title}|${i}`} className={`ev kind-${e.kind}`} data-testid="event">
                  <span className="ev-dot" aria-hidden="true" />
                  <span className="ev-date">{eventDateLabel(e)}</span>
                  <span className="ev-body">
                    <span className="ev-kind">{KIND_LABEL[e.kind]}</span>
                    <strong>{e.title}</strong>
                    {describeEvent(e) ? <span className="muted"> {describeEvent(e)}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}
