import { useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { SAFETY_COPY } from "../lib/safetyCopy";
import { CATEGORIES, CATEGORY_LABEL, consentStatus, type AccessEntry, type Category, type Consent, type Doctor } from "../data/api";

const DAYS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 365, label: "1 ano" },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const catLabel = (c: string) => CATEGORY_LABEL[c as Category] ?? c;

export interface PrivacyViewProps {
  doctors: Doctor[];
  consents: Consent[];
  log: AccessEntry[];
  onGrant: (input: { doctorId: string; categories: Category[]; days: number }) => Promise<void>;
  onRevoke: (consentId: string) => Promise<void>;
  now?: Date;
  error?: string | null;
}

/** Tela de privacidade do paciente: o que cada medico pode ver, ate quando, e quem abriu. Revogar vale na hora. */
export function PrivacyView({ doctors, consents, log, onGrant, onRevoke, now = new Date(), error = null }: PrivacyViewProps) {
  const [doctorId, setDoctorId] = useState("");
  const [cats, setCats] = useState<ReadonlySet<Category>>(new Set(["exams"]));
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<Consent | null>(null);

  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.full_name ?? "Médico";
  const active = consents.filter((c) => consentStatus(c, now) === "active");
  const past = consents.filter((c) => consentStatus(c, now) !== "active");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setLocalError(null);
    try {
      await fn();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  function grant(e: FormEvent) {
    e.preventDefault();
    if (!doctorId) return setLocalError("Escolha o médico.");
    void run(() => onGrant({ doctorId, categories: CATEGORIES.filter((c) => cats.has(c)), days }));
  }

  const shownError = localError ?? error;

  return (
    <div className="privacy">
      <section className="panel">
        <h2>Privacidade e acessos</h2>
        <h3 className="list-title">Quem pode ver os seus dados</h3>
        <p className="muted">
          Nada é compartilhado sem a sua permissão. Você escolhe o médico, o que ele vê e por quanto tempo, e pode retirar o acesso a
          qualquer momento.
        </p>
        {active.length === 0 ? (
          <p>Nenhum médico tem acesso agora.</p>
        ) : (
          <ul className="consents">
            {active.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{doctorName(c.doctor_id)}</strong>
                  <div className="muted">
                    Vê: {c.categories.map(catLabel).join(", ")} · até {fmtDate(c.expires_at)}
                  </div>
                </div>
                <button type="button" className="danger" disabled={busy} onClick={() => setToRevoke(c)}>
                  Revogar acesso
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Liberar para um médico</h2>
        <form onSubmit={grant} className="grant" aria-label="Liberar acesso">
          <label htmlFor="doctor">Médico</label>
          <select id="doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Escolha…</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
                {d.crm ? ` (${d.crm})` : ""}
              </option>
            ))}
          </select>

          <fieldset>
            <legend>O que ele pode ver</legend>
            {CATEGORIES.map((c) => (
              <label key={c} className="check">
                <input
                  type="checkbox"
                  checked={cats.has(c)}
                  onChange={() =>
                    setCats((prev) => {
                      const next = new Set(prev);
                      if (next.has(c)) next.delete(c);
                      else next.add(c);
                      return next;
                    })
                  }
                />{" "}
                {CATEGORY_LABEL[c]}
              </label>
            ))}
          </fieldset>

          <label htmlFor="days">Por quanto tempo</label>
          <select id="days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          {shownError && (
            <p className="form-error" role="alert">
              {shownError}
            </p>
          )}
          <div className="sticky-action">
            <button type="submit" className="primary wide" disabled={busy}>
              Liberar acesso
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Quem abriu os seus dados</h2>
        {log.length === 0 ? (
          <p className="muted">Nenhum acesso registrado ainda.</p>
        ) : (
          <ul className="access-log">
            {log.map((a) => (
              <li key={a.id}>
                {fmtDateTime(a.accessed_at)} — <strong>{doctorName(a.doctor_id)}</strong> abriu {catLabel(a.category)}
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <details className="past">
            <summary>Acessos encerrados ({past.length})</summary>
            <ul>
              {past.map((c) => (
                <li key={c.id}>
                  {doctorName(c.doctor_id)} — {consentStatus(c, now) === "revoked" ? "revogado" : "vencido"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <Sheet open={!!toRevoke} title="Revogar acesso?" onClose={() => setToRevoke(null)}>
        {toRevoke && (
          <div className="confirm">
            <p><strong>{doctorName(toRevoke.doctor_id)}</strong> · {toRevoke.categories.map(catLabel).join(", ")}</p>
            <p>{SAFETY_COPY.revoke}</p>
            <div className="sheet-actions">
              <button
                type="button"
                className="danger wide"
                disabled={busy}
                onClick={() => {
                  const id = toRevoke.id;
                  setToRevoke(null);
                  void run(() => onRevoke(id));
                }}
              >
                Sim, revogar acesso
              </button>
              <button type="button" className="secondary wide" data-autofocus onClick={() => setToRevoke(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
