import { fmtDate } from "../lib/format";
import { evidenceChartOptions, SEVERITY_LABEL, SEVERITY_SYMBOL, sortAlerts } from "../lib/wearables";
import type { Alert } from "../types";
import { MiniChart } from "./MiniChart";

/** Alertas do relogio. Cada um mostra "Por que disparou?": a regra, o que foi observado, a janela analisada e os
 *  pontos que o motor usou, com a linha de referencia. O alerta orienta procurar um medico e nunca diagnostica. */
export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0)
    return (
      <p className="muted" role="status">
        Nenhum alerta no momento. Os sinais do relógio estão dentro do seu padrão.
      </p>
    );
  return (
    <section aria-label="Alertas do relógio" className="alerts">
      {sortAlerts(alerts).map((a) => {
        const ev = a.evidence;
        const opts = evidenceChartOptions(ev);
        return (
          <article key={`${a.kind}|${a.triggered_at}`} className={`alert sev-${a.severity}`} data-testid="alert" data-severity={a.severity}>
            <header className="alert-head">
              <span className="sev">
                <span aria-hidden="true">{SEVERITY_SYMBOL[a.severity]}</span> {SEVERITY_LABEL[a.severity]}
              </span>
              <h3>{a.title}</h3>
              <time dateTime={a.triggered_at}>{fmtDate(a.triggered_at.slice(0, 10))}</time>
            </header>
            <p className="alert-msg">{a.message}</p>
            <details className="why">
              <summary>Por que disparou?</summary>
              <dl>
                <div>
                  <dt>Regra</dt>
                  <dd>{ev.rule}</dd>
                </div>
                <div>
                  <dt>Observado</dt>
                  <dd>{ev.observed}</dd>
                </div>
                <div>
                  <dt>Janela analisada</dt>
                  <dd>
                    {fmtDate(ev.window.from.slice(0, 10))} a {fmtDate(ev.window.to.slice(0, 10))}
                  </dd>
                </div>
              </dl>
              <MiniChart
                title={`${a.title}: evidência`}
                series={ev.series}
                referenceLines={ev.reference_lines}
                baseline={ev.baseline}
                domainFrom={ev.window.from}
                domainTo={ev.window.to}
                mode={opts.mode}
                divisor={opts.divisor}
                unitLabel={opts.unitLabel}
              />
              {ev.note && <p className="muted">{ev.note}</p>}
            </details>
          </article>
        );
      })}
    </section>
  );
}
