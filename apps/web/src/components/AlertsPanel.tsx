import { EmptyState } from "./ui";
import { ChevronRight, Info, MessageCircle } from "lucide-react";
import { useState } from "react";
import { fmtDate } from "../lib/format";
import { SAFETY_COPY } from "../lib/safetyCopy";
import { evidenceChartOptions, sortAlerts } from "../lib/wearables";
import type { Alert } from "../types";
import { MiniChart } from "./MiniChart";
import { Sheet } from "./Sheet";
import { StateBadge } from "./ui";
import "./phase3.css";

const keyOf = (a: Alert) => `${a.kind}|${a.triggered_at}`;

/** Conteúdo de "Por que disparou": regra, valor observado, janela e gráfico da evidência. Mesmo na folha e no painel. */
function Evidence({ a, headingLevel = 2, showTitle = true }: { a: Alert; headingLevel?: 2 | 3; showTitle?: boolean }) {
  const ev = a.evidence;
  const opts = evidenceChartOptions(ev);
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="evid">
      <StateBadge state={a.severity} />
      {showTitle && <H className="evid-title">{a.title}</H>}
      <p className="caption">{fmtDate(a.triggered_at.slice(0, 10))}</p>
      <p className="evid-label">Por que disparou</p>
      <dl className="evid-dl">
        <div><dt>Regra</dt><dd>{ev.rule}</dd></div>
        <div><dt>Valor observado</dt><dd>{ev.observed}</dd></div>
        <div><dt>Janela</dt><dd>{fmtDate(ev.window.from.slice(0, 10))} a {fmtDate(ev.window.to.slice(0, 10))}</dd></div>
      </dl>
      <div className="evid-chart">
        <MiniChart title={`${a.title}: evidência`} series={ev.series} referenceLines={ev.reference_lines} baseline={ev.baseline}
          domainFrom={ev.window.from} domainTo={ev.window.to} mode={opts.mode} divisor={opts.divisor} unitLabel={opts.unitLabel} height={200} />
      </div>
      {ev.note && <p className="caption">{ev.note}</p>}
      <div className="evid-call">
        <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
        <div><strong>{SAFETY_COPY.alertsAction}</strong><p>Este alerta orienta; não faz diagnóstico.</p></div>
      </div>
    </div>
  );
}

/** Alertas do relógio. Cada um mostra por que disparou; orienta procurar um médico e nunca diagnostica. */
export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const sorted = sortAlerts(alerts);
  const [selected, setSelected] = useState<string | null>(sorted[0] ? keyOf(sorted[0]) : null);
  const [sheet, setSheet] = useState<Alert | null>(null);
  if (alerts.length === 0)
    return (
      <EmptyState title="Nenhum alerta no momento." description="Os sinais do relógio estão dentro do seu padrão." />
    );
  const current = sorted.find((a) => keyOf(a) === selected) ?? sorted[0]!;
  const open = (a: Alert) => {
    setSelected(keyOf(a));
    if (typeof window !== "undefined" && window.innerWidth < 1024) setSheet(a);
  };
  return (
    <div className="al-grid">
      <section aria-labelledby="h-al-list" className="al-list">
        <h3 id="h-al-list" className="sec-title">Alertas</h3>
        <ul>
          {sorted.map((a) => (
            <li key={keyOf(a)}>
              <article className={`al-card${keyOf(a) === keyOf(current) ? " is-sel" : ""}`} data-testid="alert" data-severity={a.severity}>
                <div className="al-row"><StateBadge state={a.severity} /><time className="caption" dateTime={a.triggered_at}>{fmtDate(a.triggered_at.slice(0, 10))}</time></div>
                <h4 className="al-title">{a.title}</h4>
                <p className="al-msg">{a.message}</p>
                <button type="button" className="al-why" aria-label={`Ver por quê: ${a.title}`} onClick={() => open(a)}>Ver por quê<ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" /></button>
              </article>
            </li>
          ))}
        </ul>
      </section>
      <aside className="al-panel ds-card" aria-label="Por que disparou">
        <Evidence a={current} headingLevel={3} />
      </aside>
      <Sheet open={sheet !== null} title={sheet?.title ?? "Alerta"} onClose={() => setSheet(null)}>
        {sheet && <Evidence a={sheet} showTitle={false} />}
      </Sheet>
    </div>
  );
}

export function AlertsNote() {
  return (
    <p className="al-note"><Info size={20} strokeWidth={1.75} aria-hidden="true" /><span>{SAFETY_COPY.alertsIntro}</span></p>
  );
}
