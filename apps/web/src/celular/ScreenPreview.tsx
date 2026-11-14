import { Eye } from "lucide-react";
import { Dashboard } from "../App";
import { Login } from "../auth/Login";
import { AppShell } from "../components/AppShell";
import { DoctorSummary, ReadOnlyStrip } from "../components/DoctorSummary";
import { PatientList } from "../components/PatientList";
import { PrivacyView } from "../components/PrivacyView";
import { UploadPanel } from "../components/UploadPanel";
import { Button, EmptyState, ErrorState } from "../components/ui";
import { ScreenSkeleton } from "../components/ScreenSkeleton";
import demo from "../demo/marta.json";
import type { HealthData } from "../types";
import type { Category } from "../data/api";
import { doctorReadOnlyCopy } from "../lib/safetyCopy";

/** Uma tela isolada, com dados sintéticos, para a vitrine /celular (sem backend). */
const data = demo as HealthData;
const now = new Date("2026-11-14T12:00:00Z");
const all: Category[] = ["exams", "history", "wearables"];
const doctors = [{ id: "d1", full_name: "Dr. Henrique", crm: "CRM-SP 000000" }];
const consents = [{ id: "c1", patient_id: "p1", doctor_id: "d1", categories: all, granted_at: "2026-10-15T12:00:00Z", expires_at: "2026-12-14T12:00:00Z", revoked_at: null }];
const log = [{ id: 1, doctor_id: "d1", category: "exams", action: "read", accessed_at: "2026-11-10T14:20:00Z" }];
const photo = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#f4efe6"/><rect x="60" y="60" width="480" height="680" fill="#fff" stroke="#ccc"/>' + Array.from({ length: 14 }, (_, i) => `<rect x="100" y="${130 + i * 40}" width="${200 + (i * 37) % 200}" height="12" fill="#bbb"/>`).join("") + "</svg>");
const noop = async () => {};
const strip = <ReadOnlyStrip icon={<Eye size={20} strokeWidth={1.75} aria-hidden="true" />} text={doctorReadOnlyCopy("Exames, Histórico, Relógio e alertas")} />;

export function ScreenPreview({ screen }: { screen: string }) {
  switch (screen) {
    case "login": return <Login onSubmit={async () => null} onDemo={() => {}} />;
    case "exames": return <Dashboard data={data} initialView="exames" />;
    case "linha": return <Dashboard data={data} initialView="exames" initialExamTab="linha" />;
    case "alertas": return <Dashboard data={data} initialView="alertas" />;
    case "enviar": return <Dashboard data={data} initialView="enviar" upload={<UploadPanel step="idle" onFile={() => {}} onReset={() => {}} />} />;
    case "foto": return <Dashboard data={data} initialView="enviar" upload={<UploadPanel step="idle" onFile={() => {}} onReset={() => {}} initialPhoto={photo} />} />;
    case "acessos": return <Dashboard data={data} initialView="acessos" privacy={<PrivacyView doctors={doctors} consents={consents} log={log} onGrant={noop} onRevoke={noop} now={now} />} />;
    case "medico": return (
      <AppShell doctor current="pacientes" onGo={() => {}} accountName="Dr. Henrique" synthetic title="Meus pacientes">
        <PatientList patients={[{ id: "p1", full_name: data.patient.full_name, categories: all, expires_at: "2026-12-14T12:00:00Z" }]} onOpen={() => {}} />
      </AppShell>
    );
    case "resumo": return (
      <AppShell doctor current="pacientes" onGo={() => {}} accountName={data.patient.full_name} synthetic title="Meus pacientes">
        {strip}
        <DoctorSummary data={data} categories={all} onBack={() => {}} onAll={() => {}} now={now} />
      </AppShell>
    );
    case "estados": return (
      <Dashboard data={data} initialView="acessos" privacy={
        <main className="screen" style={{ display: "grid", gap: 16 }}>
          <h2 className="page-title">Estados padrão</h2>
          <EmptyState title="Nenhum acesso registrado ainda." description="Cada vez que um médico abrir seus dados, aparece aqui." action={<Button variant="secondary">Ver meus exames</Button>} />
          <ErrorState title="Não foi possível carregar os dados." description="Confira a internet e tente de novo." onRetry={() => {}} />
          <ScreenSkeleton />
        </main>} />
    );
    default: return <Dashboard data={data} initialView="inicio" />;
  }
}
