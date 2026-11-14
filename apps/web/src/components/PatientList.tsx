import { Clock, FlaskConical, History, Lock, Watch, type LucideIcon } from "lucide-react";
import type { Category, MyPatient } from "../data/api";
import { Button } from "./ui";
import "./privacy.css";
import "./doctor.css";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const CAT: Record<Category, { label: string; icon: LucideIcon }> = {
  exams: { label: "Exames", icon: FlaskConical }, history: { label: "Histórico", icon: History }, wearables: { label: "Relógio e alertas", icon: Watch },
};

/** Pacientes que liberaram dados ao médico agora. Cada um mostra o que foi liberado e até quando. */
export function PatientList({ patients, onOpen }: { patients: MyPatient[]; onOpen: (p: MyPatient) => void }) {
  return (
    <main className="screen drp" aria-labelledby="drp-h">
      <h2 id="drp-h" className="page-title">Meus pacientes</h2>
      {patients.length === 0 ? (
        <div className="drp-empty"><Lock size={32} strokeWidth={1.75} aria-hidden="true" /><p>Nenhum paciente liberou acesso a você no momento.</p></div>
      ) : (
        <ul className="drp-list">
          {patients.map((p) => (
            <li key={p.id} className="drp-card">
              <h3 className="drp-name">{p.full_name}</h3>
              <p className="sr-only">Liberado: {p.categories.map((c) => CAT[c].label).join(", ")}</p>
              <ul className="pv-cats" aria-hidden="true">
                {p.categories.map((c) => { const I = CAT[c].icon; return <li key={c} className="pv-cat"><I size={16} strokeWidth={1.75} aria-hidden="true" />{CAT[c].label}</li>; })}
              </ul>
              <p className="caption pv-until"><Clock size={16} strokeWidth={1.75} aria-hidden="true" />até {fmtDate(p.expires_at)}</p>
              <Button variant="secondary" aria-label={`Abrir ${p.full_name}`} onClick={() => onOpen(p)}>Abrir</Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
