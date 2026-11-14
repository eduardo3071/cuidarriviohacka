import { useCallback, useEffect, useState } from "react";
import { PrivacyView } from "../components/PrivacyView";
import { grantConsent, listAccessLog, listConsents, listDoctors, revokeConsent, type AccessEntry, type Consent, type Doctor } from "../data/api";
import { MemoryRest } from "../data/memoryRest";
import type { Rest } from "../data/rest";

export const DEMO_PATIENT_ID = "demo-marta";

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Privacidade SIMULADA da demonstracao: medicos e historico ficticios, vivos so na memoria do navegador (somem ao
 *  recarregar). Usa as MESMAS funcoes da tela real (dar, revogar, listar), entao o comportamento e o de verdade:
 *  validacao, vencimento, revogacao imediata e registro de quem abriu o que. Nada vai ao servidor. */
export function makeDemoPrivacyRest(now: number = Date.now()): Rest {
  return new MemoryRest({
    doctors: [
      { id: "dr-helena", full_name: "Dra. Helena Ribeiro", crm: "CRM-SP 100001" },
      { id: "dr-paulo", full_name: "Dr. Paulo Mendes", crm: "CRM-SP 100002" },
      { id: "dr-camila", full_name: "Dra. Camila Torres", crm: "CRM-SP 100003" },
    ],
    consents: [
      {
        id: "c-seed-1",
        patient_id: DEMO_PATIENT_ID,
        doctor_id: "dr-helena",
        categories: ["exams", "history"],
        granted_at: iso(now - 12 * DAY),
        expires_at: iso(now + 78 * DAY),
        revoked_at: null,
      },
    ],
    access_log: [
      { id: 2, patient_id: DEMO_PATIENT_ID, doctor_id: "dr-helena", category: "history", action: "view", accessed_at: iso(now - 3 * DAY) },
      { id: 1, patient_id: DEMO_PATIENT_ID, doctor_id: "dr-helena", category: "exams", action: "view", accessed_at: iso(now - 3 * DAY - 120_000) },
    ],
  });
}

export function DemoPrivacy({ rest }: { rest: Rest }) {
  const [state, setState] = useState<{ doctors: Doctor[]; consents: Consent[]; log: AccessEntry[] } | null>(null);
  const load = useCallback(async () => {
    const [doctors, consents, log] = await Promise.all([listDoctors(rest), listConsents(rest, DEMO_PATIENT_ID), listAccessLog(rest, DEMO_PATIENT_ID)]);
    setState({ doctors, consents, log });
  }, [rest]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!state) return null;
  return (
    <div className="screen">
      <PrivacyView
        doctors={state.doctors}
        consents={state.consents}
        log={state.log}
        onGrant={async ({ doctorId, categories, days }) => {
          await grantConsent(rest, { patientId: DEMO_PATIENT_ID, doctorId, categories, days });
          await load();
        }}
        onRevoke={async (id) => {
          await revokeConsent(rest, id);
          await load();
        }}
      />
    </div>
  );
}
