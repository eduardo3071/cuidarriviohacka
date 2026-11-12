import { CATEGORY_LABEL, type MyPatient } from "../data/api";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Pacientes que liberaram dados ao medico agora. Cada um mostra o que foi liberado e ate quando. */
export function PatientList({ patients, onOpen }: { patients: MyPatient[]; onOpen: (p: MyPatient) => void }) {
  if (patients.length === 0)
    return (
      <section className="panel">
        <h2>Seus pacientes</h2>
        <p>Nenhum paciente liberou acesso a você no momento.</p>
      </section>
    );
  return (
    <section className="panel">
      <h2>Seus pacientes</h2>
      <p className="muted">Você vê somente o que cada paciente liberou, e cada abertura fica registrada para ele.</p>
      <ul className="patients">
        {patients.map((p) => (
          <li key={p.id}>
            <div>
              <strong>{p.full_name}</strong>
              <div className="muted">
                Liberou: {p.categories.map((c) => CATEGORY_LABEL[c]).join(", ")} · até {fmtDate(p.expires_at)}
              </div>
            </div>
            <button type="button" className="primary" onClick={() => onOpen(p)}>
              Abrir
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
