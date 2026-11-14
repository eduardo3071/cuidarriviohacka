import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import App, { Dashboard } from "./App";
import { Login } from "./auth/Login";
import { useAuth } from "./auth/useAuth";
import { PatientList } from "./components/PatientList";
import { PrivacyView } from "./components/PrivacyView";
import { UploadPanel } from "./components/UploadPanel";
import { ConnectionNotice, Loading } from "./components/ConnectionNotice";
import { makeApiFetch } from "./data/apiFetch";
import type { ApiFetch } from "./data/documents";
import { config, isConfigured } from "./config";
import {
  CATEGORY_LABEL,
  grantConsent,
  listAccessLog,
  listConsents,
  listDoctors,
  listMyPatients,
  loadHealthData,
  logAccess,
  revokeConsent,
  type AccessEntry,
  type Consent,
  type Doctor,
  type MyPatient,
  type Role,
} from "./data/api";
import { supabaseRest, type Rest } from "./data/rest";
import type { HealthData } from "./types";
import { getSupabase } from "./lib/supabase";

/** Carrega algo assincrono e mostra "carregando" / erro / resultado. */
function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    fn()
      .then((d) => alive && (setData(d), setError(null)))
      .catch(() => alive && setError("Não foi possível carregar os dados."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: useCallback(() => setTick((t) => t + 1), []) };
}

function Shell({ who, subtitle, onSignOut, children }: { who: string; subtitle: string; onSignOut: () => void; children: ReactNode }) {
  return (
    <div className="shell">
      <div className="shellbar">
        <span>
          <strong>{who}</strong> <span className="muted">· {subtitle}</span>
        </span>
        <button type="button" className="link" onClick={onSignOut}>
          Sair
        </button>
      </div>
      {children}
    </div>
  );
}

function Status({ error, children }: { error: string | null; children: ReactNode }) {
  return (
    <main className="app">
      <ConnectionNotice />
      {error ? <p role="alert">{error}</p> : typeof children === "string" && children.startsWith("Carregando") ? <Loading /> : <p>{children}</p>}
    </main>
  );
}

// ------------------------------------------------------------------ paciente
function PatientHome({ rest, api, role }: { rest: Rest; api: ApiFetch | null; role: Extract<Role, { kind: "patient" }> }) {
  const health = useAsync<HealthData>(
    () => loadHealthData(rest, { id: role.patientId, name: role.name, birthDate: role.birthDate, sex: role.sex }, config.synthetic),
    [rest, role.patientId],
  );
  if (!health.data) return <Status error={health.error}>Carregando…</Status>;
  return (
    <Dashboard
      data={health.data}
      upload={
        api ? (
          <UploadPanel api={api} onConfirmed={health.reload} />
        ) : (
          <main className="screen panel">
            <h2>Enviar laudo</h2>
            <p>O envio de laudos não está disponível agora. Tente mais tarde.</p>
          </main>
        )
      }
      privacy={<PrivacyPanel rest={rest} patientId={role.patientId} />}
    />
  );
}

function PrivacyPanel({ rest, patientId }: { rest: Rest; patientId: string }) {
  const state = useAsync<{ doctors: Doctor[]; consents: Consent[]; log: AccessEntry[] }>(
    async () => {
      const [doctors, consents, log] = await Promise.all([listDoctors(rest), listConsents(rest, patientId), listAccessLog(rest, patientId)]);
      return { doctors, consents, log };
    },
    [rest, patientId],
  );
  if (!state.data) return <Status error={state.error}>Carregando…</Status>;
  return (
    <div className="screen">
      <PrivacyView
        doctors={state.data.doctors}
        consents={state.data.consents}
        log={state.data.log}
        onGrant={async ({ doctorId, categories, days }) => {
          await grantConsent(rest, { patientId, doctorId, categories, days });
          state.reload();
        }}
        onRevoke={async (id) => {
          await revokeConsent(rest, id);
          state.reload();
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ medico
function DoctorHome({ rest, role }: { rest: Rest; role: Extract<Role, { kind: "doctor" }> }) {
  const [open, setOpen] = useState<MyPatient | null>(null);
  const patients = useAsync<MyPatient[]>(() => listMyPatients(rest, role.doctorId), [rest, role.doctorId, open === null]);
  if (open) return <DoctorPatientView rest={rest} doctorId={role.doctorId} patient={open} onBack={() => setOpen(null)} />;
  if (!patients.data) return <Status error={patients.error}>Carregando…</Status>;
  return (
    <div className="app">
      <PatientList patients={patients.data} onOpen={setOpen} />
    </div>
  );
}

function DoctorPatientView({ rest, doctorId, patient, onBack }: { rest: Rest; doctorId: string; patient: MyPatient; onBack: () => void }) {
  const health = useAsync<HealthData>(async () => {
    // a auditoria vem ANTES dos dados e falha fechada: se nao deu para registrar o acesso, os dados nao aparecem
    await logAccess(rest, { doctorId, patientId: patient.id, categories: patient.categories });
    return loadHealthData(rest, { id: patient.id, name: patient.full_name }, config.synthetic);
  }, [rest, doctorId, patient.id]);
  const banner = useMemo(
    () => (
      <div className="readonly-banner" role="note">
        <button type="button" className="link" onClick={onBack}>
          ← Voltar aos pacientes
        </button>
        <span>
          Somente leitura: nada pode ser alterado, apagado ou enviado. Liberado pelo paciente: {patient.categories.map((c) => CATEGORY_LABEL[c]).join(", ")}.
        </span>
      </div>
    ),
    [patient.categories, onBack],
  );
  if (!health.data) return <Status error={health.error}>Carregando…</Status>;
  return <Dashboard data={health.data} banner={banner} readOnly />;
}

// ------------------------------------------------------------------ raiz
function Authenticated({ client }: { client: SupabaseClient }) {
  const { state, signIn, signOut } = useAuth(client);
  const rest = useMemo(() => supabaseRest(client), [client]);
  const api = useMemo(() => (config.apiUrl ? makeApiFetch(client, config.apiUrl) : null), [client]);
  const [demo, setDemo] = useState(false);

  if (demo) return <App />;
  if (state.status === "loading") return <Status error={null}>Carregando…</Status>;
  if (state.status === "error") return <Status error={state.message}>{null}</Status>;
  if (state.status === "out") return <Login onSubmit={signIn} onDemo={() => setDemo(true)} />;

  const { role, email } = state;
  if (role.kind === "none")
    return (
      <Shell who={email} subtitle="sem perfil" onSignOut={() => void signOut()}>
        <Status error={null}>Esta conta ainda não tem perfil de paciente ou médico. Fale com quem criou o seu acesso.</Status>
      </Shell>
    );
  return role.kind === "patient" ? (
    <Shell who={role.name} subtitle="paciente" onSignOut={() => void signOut()}>
      <PatientHome rest={rest} api={api} role={role} />
    </Shell>
  ) : (
    <Shell who={role.name} subtitle="médico" onSignOut={() => void signOut()}>
      <DoctorHome rest={rest} role={role} />
    </Shell>
  );
}

export default function Root() {
  // sem URL/chave do Supabase no .env, o app roda so em modo demonstracao
  if (!isConfigured) return <App />;
  return <Authenticated client={getSupabase()} />;
}
