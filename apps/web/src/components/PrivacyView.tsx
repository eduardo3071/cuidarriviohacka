import { Check, ChevronDown, ChevronLeft, Clock, FlaskConical, History, Watch, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, CATEGORY_LABEL, consentStatus, type AccessEntry, type Category, type Consent, type Doctor } from "../data/api";
import { SAFETY_COPY } from "../lib/safetyCopy";
import { Sheet } from "./Sheet";
import { Button } from "./ui";
import "./privacy.css";

const DAYS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 365, label: "1 ano" },
];
const CAT_INFO: Record<Category, { title: string; caption: string; icon: LucideIcon }> = {
  exams: { title: "Exames", caption: "resultados de laboratório", icon: FlaskConical },
  history: { title: "Histórico", caption: "consultas, remédios e vacinas", icon: History },
  wearables: { title: "Relógio e alertas", caption: "sinais do relógio e alertas", icon: Watch },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).replace(",", "");
const catLabel = (c: string) => CATEGORY_LABEL[c as Category] ?? c;
const catShort = (c: string) => CAT_INFO[c as Category]?.title ?? c;
const joinPt = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

export interface PrivacyViewProps {
  doctors: Doctor[];
  consents: Consent[];
  log: AccessEntry[];
  onGrant: (input: { doctorId: string; categories: Category[]; days: number }) => Promise<void>;
  onRevoke: (consentId: string) => Promise<void>;
  now?: Date;
  error?: string | null;
}

type GrantInput = { doctorId: string; categories: Category[]; days: number };

/** Assistente de 4 passos. "steps": um passo por vez (celular); "stacked": todos na vertical (computador). */
function GrantWizard({ doctors, now, busy, error, mode, onCancel, onSubmit }: {
  doctors: Doctor[]; now: Date; busy: boolean; error: string | null; mode: "steps" | "stacked"; onCancel?: () => void; onSubmit: (g: GrantInput) => void;
}) {
  const [step, setStep] = useState(0);
  const [doctorId, setDoctorId] = useState("");
  const [cats, setCats] = useState<ReadonlySet<Category>>(new Set(["exams"]));
  const [days, setDays] = useState(30);
  const [localError, setLocalError] = useState<string | null>(null);
  const doctor = doctors.find((d) => d.id === doctorId);
  const until = fmtDate(new Date(now.getTime() + days * 86_400_000).toISOString());
  const chosen = CATEGORIES.filter((c) => cats.has(c));
  const valid = [Boolean(doctorId), chosen.length > 0, true, true];
  const missing = ["Escolha o médico.", "Escolha pelo menos uma categoria.", "", ""];
  const submit = () => {
    const bad = valid.findIndex((v) => !v);
    if (bad >= 0) { setLocalError(missing[bad]!); if (mode === "steps") setStep(bad); return; }
    setLocalError(null);
    onSubmit({ doctorId, categories: chosen, days });
  };
  const next = () => {
    if (!valid[step]) return setLocalError(missing[step]!);
    setLocalError(null);
    if (step === 3) submit(); else setStep(step + 1);
  };
  const toggle = (c: Category) => setCats((prev) => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const opt = (sel: boolean) => `pv-opt${sel ? " is-sel" : ""}`;

  const bodies = [
    <fieldset key="0" className="pv-q"><legend className="sec-title">Para qual médico?</legend>
      <div className="pv-opts" role="radiogroup">
        {doctors.length === 0 && <p className="caption">Nenhum médico disponível.</p>}
        {doctors.map((d) => (
          <label key={d.id} className={opt(d.id === doctorId)}>
            <input type="radio" name={`doc-${mode}`} className="sr-only" checked={d.id === doctorId} onChange={() => setDoctorId(d.id)} />
            <span className="pv-opt-t">{d.full_name}</span>{d.crm && <span className="caption">{d.crm}</span>}
            {d.id === doctorId && <Check className="pv-opt-check" size={20} strokeWidth={2} aria-hidden="true" />}
          </label>
        ))}
      </div>
    </fieldset>,
    <fieldset key="1" className="pv-q"><legend className="sec-title">O que ele pode ver?</legend>
      <div className="pv-opts">
        {CATEGORIES.map((c) => (
          <label key={c} className={opt(cats.has(c))}>
            <input type="checkbox" className="sr-only" checked={cats.has(c)} onChange={() => toggle(c)} />
            <span className="pv-opt-t">{CAT_INFO[c].title}</span><span className="caption">{CAT_INFO[c].caption}</span>
            {cats.has(c) && <Check className="pv-opt-check" size={20} strokeWidth={2} aria-hidden="true" />}
          </label>
        ))}
      </div>
    </fieldset>,
    <fieldset key="2" className="pv-q"><legend className="sec-title">Por quanto tempo?</legend>
      <div className="pv-days" role="radiogroup">
        {DAYS.map((d) => (
          <label key={d.value} className={opt(d.value === days)}>
            <input type="radio" name={`days-${mode}`} className="sr-only" checked={d.value === days} onChange={() => setDays(d.value)} />
            <span className="pv-opt-t">{d.label}</span>
          </label>
        ))}
      </div>
    </fieldset>,
    <div key="3" className="pv-q"><h3 className="sec-title">Revise antes de liberar</h3>
      <div className="pv-review">
        <p>{doctor ? doctor.full_name : "O médico escolhido"} poderá ver {chosen.length ? joinPt(chosen.map((c) => CAT_INFO[c].title.toLowerCase())) : "—"} até {until}.</p>
        <p className="caption">Você pode revogar quando quiser.</p>
      </div>
    </div>,
  ];
  const err = localError ?? error;
  const errEl = err && <p className="pv-err" role="alert">{err}</p>;

  if (mode === "stacked")
    return (
      <form className="pv-stack" aria-label="Liberar acesso" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <ol className="pv-vsteps">
          {bodies.map((b, i) => (
            <li key={i} className={`pv-vstep${valid.slice(0, i + 1).every(Boolean) && i < 3 ? " is-done" : ""}`}>
              <span className="pv-vdot" aria-hidden="true" />{b}
            </li>
          ))}
        </ol>
        {errEl}
        <Button type="submit" disabled={busy}>Liberar acesso</Button>
      </form>
    );

  return (
    <div className="pv-wiz" role="dialog" aria-modal="true" aria-label="Liberar para um médico">
      <div className="pv-wiz-top">
        <button type="button" className="pv-cancel" onClick={onCancel}><ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />Cancelar</button>
        <span className="caption">Passo {step + 1} de 4</span>
      </div>
      <ol className="pv-wire" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <li key={i} className={i < step ? "is-done" : i === step ? "is-now" : ""} />)}
      </ol>
      <div className="pv-wiz-body">{bodies[step]}{errEl}</div>
      <div className="pv-wiz-bar">
        <Button variant="link" className="pv-back" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</Button>
        <Button className="pv-next" disabled={busy} onClick={next}>{step === 3 ? "Liberar acesso" : "Continuar"}</Button>
      </div>
    </div>
  );
}

/** Tela de privacidade do paciente: o que cada médico pode ver, até quando, e quem abriu. Revogar vale na hora. */
export function PrivacyView({ doctors, consents, log, onGrant, onRevoke, now = new Date(), error = null }: PrivacyViewProps) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<Consent | null>(null);
  const [wizard, setWizard] = useState(false);
  const [wizKey, setWizKey] = useState(0);

  const doc = (id: string) => doctors.find((d) => d.id === id);
  const doctorName = (id: string) => doc(id)?.full_name ?? "Médico";
  const active = consents.filter((c) => consentStatus(c, now) === "active");
  const past = consents.filter((c) => consentStatus(c, now) !== "active");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setLocalError(null);
    try { await fn(); return true; } catch (e) { setLocalError(e instanceof Error ? e.message : "Não foi possível concluir."); return false; } finally { setBusy(false); }
  }
  const grant = async (g: GrantInput) => { if (await run(() => onGrant(g))) { setWizard(false); setWizKey((k) => k + 1); } };
  const shownError = localError ?? error;

  return (
    <div className="pv">
      <h2 className="page-title">Privacidade e acessos</h2>
      <div className="pv-grid">
        <div className="pv-main">
          <h3 className="sec-title">Quem pode ver os seus dados agora</h3>
          <p className="caption">Nada é compartilhado sem a sua permissão. Você escolhe o médico, o que ele vê e por quanto tempo.</p>
          {active.length === 0 ? (
            <p className="pv-empty">Nenhum médico tem acesso agora.</p>
          ) : (
            <ul className="pv-list">
              {active.map((c) => (
                <li key={c.id} className="pv-doc">
                  <div className="pv-doc-row"><strong className="pv-doc-name">{doctorName(c.doctor_id)}</strong><span className="pv-active"><Check size={16} strokeWidth={2} aria-hidden="true" />Ativo</span></div>
                  {doc(c.doctor_id)?.crm && <p className="caption">{doc(c.doctor_id)!.crm}</p>}
                  <ul className="pv-cats" aria-label="O que pode ver">
                    {c.categories.map((k) => { const I = CAT_INFO[k]?.icon ?? Check; return <li key={k} className="pv-cat"><I size={16} strokeWidth={1.75} aria-hidden="true" />{catShort(k)}</li>; })}
                  </ul>
                  <p className="caption pv-until"><Clock size={16} strokeWidth={1.75} aria-hidden="true" />até {fmtDate(c.expires_at)}</p>
                  <Button variant="danger" className="pv-revoke" disabled={busy} onClick={() => setToRevoke(c)}>Revogar acesso</Button>
                </li>
              ))}
            </ul>
          )}
          {shownError && !wizard && <p className="pv-err" role="alert">{shownError}</p>}
          <Button className="pv-open" onClick={() => setWizard(true)}>Liberar para um médico</Button>

          <h3 className="sec-title">Quem abriu os seus dados</h3>
          {log.length === 0 ? (
            <p className="pv-empty">Nenhum acesso registrado ainda.</p>
          ) : (
            <ul className="pv-list">
              {log.map((a) => (
                <li key={a.id} className="pv-log">
                  <span className="pv-log-t">{doctorName(a.doctor_id)} abriu {catLabel(a.category)}</span>
                  <span className="caption">{fmtDateTime(a.accessed_at)} · somente leitura</span>
                </li>
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <details className="pv-past">
              <summary>Acessos encerrados ({past.length})<ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" /></summary>
              <ul>
                {past.map((c) => (
                  <li key={c.id}>{doctorName(c.doctor_id)} · {c.categories.map(catShort).join(", ")} · {consentStatus(c, now) === "revoked" ? "revogado" : "vencido"}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <aside className="ds-card pv-side" aria-labelledby="h-pv-grant">
          <h3 id="h-pv-grant" className="sec-title">Liberar para um médico</h3>
          <GrantWizard key={`s${wizKey}`} mode="stacked" doctors={doctors} now={now} busy={busy} error={shownError} onSubmit={(g) => void grant(g)} />
        </aside>
      </div>

      {wizard && <GrantWizard key={`w${wizKey}`} mode="steps" doctors={doctors} now={now} busy={busy} error={shownError} onCancel={() => setWizard(false)} onSubmit={(g) => void grant(g)} />}

      <Sheet open={!!toRevoke} title="Revogar acesso?" onClose={() => setToRevoke(null)}>
        {toRevoke && (
          <div className="pv-confirm">
            <p className="caption">{doctorName(toRevoke.doctor_id)} · {toRevoke.categories.map(catShort).join(", ")}</p>
            <p>{SAFETY_COPY.revoke}</p>
            <Button variant="danger-solid" disabled={busy} onClick={() => { const id = toRevoke.id; setToRevoke(null); void run(() => onRevoke(id)); }}>Revogar agora</Button>
            <Button variant="link" data-autofocus onClick={() => setToRevoke(null)}>Cancelar</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
