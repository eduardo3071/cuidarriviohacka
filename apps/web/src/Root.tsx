import { ErrorState } from "./components/ui";
import { ScreenSkeleton } from "./components/ScreenSkeleton";
import { ChevronLeft, Eye } from "lucide-react";
import { AppShell } from "./components/AppShell";
import { DoctorSummary, ReadOnlyStrip } from "./components/DoctorSummary";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import App, { Dashboard } from "./App";
import { Login } from "./auth/Login";
import { useAuth } from "./auth/useAuth";
import { PatientList } from "./components/PatientList";
import { PrivacyView } from "./components/PrivacyView";
import { UploadFlow } from "./components/UploadFlow";
import { ConnectionNotice } from "./components/ConnectionNotice";
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
import { doctorReadOnlyCopy } from "./lib/safetyCopy";

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
      {error ? <div className="screen-loading"><ErrorState title={error} description="Confira a internet e tente de novo." onRetry={() => window.location.reload()} /></div> : typeof children === "string" && children.startsWith("Carregando") ? <ScreenSkeleton /> : <p>{children}</p>}
    </main>
  );
}

// ------------------------------------------------------------------ paciente
function PatientHome({ rest, api, role, onDemo, onSignOut }: { rest: Rest; api: ApiFetch | null; role: Extract<Role, { kind: "patient" }>; onDemo: () => void; onSignOut: () => void }) {
  const health = useAsync<HealthData>(
    () => loadHealthData(rest, { id: role.patientId, name: role.name, birthDate: role.birthDate, sex: role.sex }, config.synthetic),
    [rest, role.patientId],
  );
  if (!health.data) return <Status error={health.error}>Carregando…</Status>;
  return (
    <Dashboard
      data={health.data}
      onDemo={onDemo}
      onSignOut={onSignOut}
      upload={
        api ? (
          ({ goExams }) => <UploadFlow api={api} onConfirmed={health.reload} onViewExams={goExams} />
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
function DoctorHome({ rest, role, onSignOut }: { rest: Rest; role: Extract<Role, { kind: "doctor" }>; onSignOut: () => void }) {
  const [open, setOpen] = useState<MyPatient | null>(null);
  const patients = useAsync<MyPatient[]>(() => listMyPatients(rest, role.doctorId), [rest, role.doctorId, open === null]);
  if (open) return <DoctorPatientView rest={rest} doctorId={role.doctorId} patient={open} onBack={() => setOpen(null)} onSignOut={onSignOut} />;
  if (!patients.data) return <Status error={patients.error}>Carregando…</Status>;
  return (
    <AppShell doctor current="pacientes" onGo={() => setOpen(null)} accountName={role.name} synthetic={config.synthetic} onSignOut={onSignOut} title="Meus pacientes">
      <PatientList patients={patients.data} onOpen={setOpen} />
    </AppShell>
  );
}

function DoctorPatientView({ rest, doctorId, patient, onBack, onSignOut }: { rest: Rest; doctorId: string; patient: MyPatient; onBack: () => void; onSignOut: () => void }) {
  const health = useAsync<HealthData>(async () => {
    // a auditoria vem ANTES dos dados e falha fechada: se nao deu para registrar o acesso, os dados nao aparecem
    await logAccess(rest, { doctorId, patientId: patient.id, categories: patient.categories });
    return loadHealthData(rest, { id: patient.id, name: patient.full_name }, config.synthetic);
  }, [rest, doctorId, patient.id]);
  const [all, setAll] = useState(false);
  const banner = useMemo(
    () => <ReadOnlyStrip icon={<Eye size={20} strokeWidth={1.75} aria-hidden="true" />} text={doctorReadOnlyCopy(patient.categories.map((c) => CATEGORY_LABEL[c]).join(", "))} />,
    [patient.categories],
  );
  if (!health.data) return <Status error={health.error}>Carregando…</Status>;
  if (all)
    return (
      <Dashboard data={health.data} readOnly availableCategories={patient.categories} onSignOut={onSignOut}
        banner={<>{banner}<button type="button" className="dr-back dr-back-all" onClick={() => setAll(false)}><ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />Voltar ao resumo</button></>} />
    );
  return (
    <AppShell doctor current="pacientes" onGo={onBack} accountName={health.data.patient.full_name} synthetic={health.data.synthetic} onSignOut={onSignOut} title="Meus pacientes">
      {banner}
      <DoctorSummary data={health.data} categories={patient.categories} onBack={onBack} onAll={() => setAll(true)} />
    </AppShell>
  );

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
    <PatientHome rest={rest} api={api} role={role} onDemo={() => setDemo(true)} onSignOut={() => void signOut()} />
  ) : (
    <DoctorHome rest={rest} role={role} onSignOut={() => void signOut()} />
  );
}

export default function Root() {
  // sem URL/chave do Supabase no .env, o app roda so em modo demonstracao
  if (!isConfigured) return <App />;
  return <Authenticated client={getSupabase()} />;
}
