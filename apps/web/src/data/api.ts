import type { Alert, HealthData, SeriesPoint, TimelineEvent, WearableSample } from "../types";
import { ApiError, selectAll, type Rest } from "./rest";

export type Category = "exams" | "history" | "wearables";
export const CATEGORIES: Category[] = ["exams", "history", "wearables"];
export const CATEGORY_LABEL: Record<Category, string> = {
  exams: "Exames",
  history: "Histórico (consultas, remédios e vacinas)",
  wearables: "Relógio e alertas",
};

export type Role =
  | { kind: "patient"; patientId: string; name: string; birthDate: string | null; sex: string | null }
  | { kind: "doctor"; doctorId: string; name: string }
  | { kind: "none" };

const num = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x));

// ---------------------------------------------------------------- papel
/** Quem e esta pessoa: paciente (tem linha em `patients` ligada ao login) ou medico. O RLS e quem protege os dados;
 *  isto so decide qual tela mostrar. */
export async function loadRole(rest: Rest, userId: string): Promise<Role> {
  const [p] = await rest.select<{ id: string; full_name: string; birth_date: string | null; sex: string | null }>("patients", {
    columns: "id,full_name,birth_date,sex",
    eq: { user_id: userId },
  });
  if (p) return { kind: "patient", patientId: p.id, name: p.full_name, birthDate: p.birth_date, sex: p.sex };
  const [d] = await rest.select<{ id: string; full_name: string }>("doctors", { columns: "id,full_name", eq: { user_id: userId } });
  if (d) return { kind: "doctor", doctorId: d.id, name: d.full_name };
  return { kind: "none" };
}

// ---------------------------------------------------------------- dados de saude
const POINT_COLUMNS =
  "biomarker,category,unit_canonical,collected_at,lab_name,raw_name,raw_value,raw_unit,raw_ref_low,raw_ref_high,ref_text,normalization,value,ref_low,ref_high,flag";

/** Carrega o historico de UM paciente pelas views/tabelas. O que volta depende do RLS: o proprio paciente ve tudo;
 *  um medico ve so as categorias que o paciente liberou (as outras voltam vazias). */
export async function loadHealthData(
  rest: Rest,
  patient: { id: string; name: string; birthDate?: string | null; sex?: string | null },
  synthetic: boolean,
): Promise<HealthData> {
  const eq = { patient_id: patient.id };
  const [points, events, wearables, alerts] = await Promise.all([
    selectAll<Record<string, unknown>>(rest, "observation_series", {
      columns: POINT_COLUMNS,
      eq,
      order: [{ column: "collected_at" }, { column: "raw_name" }, { column: "lab_name" }],
    }),
    selectAll<TimelineEvent>(rest, "timeline_events", {
      columns: "event_date,kind,title,detail",
      eq,
      order: [{ column: "event_date" }, { column: "kind" }, { column: "title" }],
    }),
    selectAll<{ recorded_at: string; metric: string; value: unknown; unit: string | null }>(rest, "wearable_samples", {
      columns: "recorded_at,metric,value,unit",
      eq,
      order: [{ column: "recorded_at" }, { column: "metric" }],
    }),
    selectAll<Alert>(rest, "alerts", {
      columns: "kind,severity,title,message,triggered_at,evidence",
      eq,
      order: [{ column: "triggered_at", ascending: false }, { column: "kind" }],
    }),
  ]);
  return {
    synthetic,
    patient: { full_name: patient.name, birth_date: patient.birthDate ?? null, sex: patient.sex ?? null },
    points: points.map(
      (r): SeriesPoint => ({
        biomarker: (r.biomarker as string | null) ?? null,
        category: (r.category as string | null) ?? null,
        unit_canonical: (r.unit_canonical as string | null) ?? null,
        collected_at: String(r.collected_at),
        lab_name: (r.lab_name as string | null) ?? null,
        raw_name: String(r.raw_name),
        raw_value: Number(r.raw_value),
        raw_unit: (r.raw_unit as string | null) ?? null,
        raw_ref_low: num(r.raw_ref_low),
        raw_ref_high: num(r.raw_ref_high),
        ref_text: (r.ref_text as string | null) ?? null,
        normalization: r.normalization as SeriesPoint["normalization"],
        value: num(r.value),
        ref_low: num(r.ref_low),
        ref_high: num(r.ref_high),
        flag: r.flag as SeriesPoint["flag"],
      }),
    ),
    events,
    wearables: wearables.map((w): WearableSample => ({ t: w.recorded_at, metric: w.metric, value: Number(w.value), unit: w.unit })),
    alerts,
  };
}

// ---------------------------------------------------------------- consentimento (paciente)
export interface Doctor {
  id: string;
  full_name: string;
  crm: string | null;
}
export interface Consent {
  id: string;
  patient_id: string;
  doctor_id: string;
  categories: Category[];
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
}
export interface AccessEntry {
  id: number;
  doctor_id: string;
  category: string;
  action: string;
  accessed_at: string;
}

export const listDoctors = (rest: Rest): Promise<Doctor[]> =>
  rest.select<Doctor>("doctors", { columns: "id,full_name,crm", order: [{ column: "full_name" }] });

export const listConsents = (rest: Rest, patientId: string): Promise<Consent[]> =>
  rest.select<Consent>("consents", {
    columns: "id,patient_id,doctor_id,categories,granted_at,expires_at,revoked_at",
    eq: { patient_id: patientId },
    order: [{ column: "granted_at", ascending: false }],
  });

export type ConsentStatus = "active" | "revoked" | "expired";

/** Revogado ganha de tudo; no instante exato do vencimento ja esta vencido (o servidor usa expires_at > now()). */
export function consentStatus(c: Pick<Consent, "revoked_at" | "expires_at">, now: Date = new Date()): ConsentStatus {
  if (c.revoked_at) return "revoked";
  return Date.parse(c.expires_at) > now.getTime() ? "active" : "expired";
}

export const MAX_CONSENT_DAYS = 365;

export async function grantConsent(
  rest: Rest,
  input: { patientId: string; doctorId: string; categories: Category[]; days: number; now?: Date },
): Promise<Consent> {
  const cats = [...new Set(input.categories)];
  if (cats.length === 0) throw new ApiError("Escolha pelo menos uma categoria para compartilhar.");
  if (cats.some((c) => !CATEGORIES.includes(c))) throw new ApiError("Categoria inválida.");
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > MAX_CONSENT_DAYS)
    throw new ApiError(`A duração deve ser de 1 a ${MAX_CONSENT_DAYS} dias.`);
  const now = input.now ?? new Date();
  const saved = await rest.insert<Consent>("consents", {
    patient_id: input.patientId,
    doctor_id: input.doctorId,
    categories: cats,
    granted_at: now.toISOString(),
    expires_at: new Date(now.getTime() + input.days * 86_400_000).toISOString(),
  });
  if (!saved) throw new ApiError("O servidor não confirmou o consentimento.");
  return saved;
}

/** Revoga na hora. Falha se nada foi alterado (consentimento inexistente ou que nao e seu: o RLS devolve 0 linhas). */
export async function revokeConsent(rest: Rest, consentId: string, now: Date = new Date()): Promise<void> {
  const rows = await rest.update<Consent>("consents", { id: consentId, revoked_at: null }, { revoked_at: now.toISOString() });
  if (rows.length === 0) throw new ApiError("Não foi possível revogar: o consentimento não existe ou já foi revogado.");
}

export const listAccessLog = (rest: Rest, patientId: string, limit = 50): Promise<AccessEntry[]> =>
  rest.select<AccessEntry>("access_log", {
    columns: "id,doctor_id,category,action,accessed_at",
    eq: { patient_id: patientId },
    order: [{ column: "accessed_at", ascending: false }],
    limit,
  });

// ---------------------------------------------------------------- visao do medico
export interface MyPatient {
  id: string;
  full_name: string;
  categories: Category[]; // o que o paciente liberou (uniao dos consentimentos ativos)
  expires_at: string; // o mais distante entre os ativos
}

/** Pacientes que liberaram dados para este medico AGORA. Consentimento revogado ou vencido some da lista. */
export async function listMyPatients(rest: Rest, doctorId: string, now: Date = new Date()): Promise<MyPatient[]> {
  const consents = (
    await rest.select<Consent>("consents", {
      columns: "id,patient_id,doctor_id,categories,granted_at,expires_at,revoked_at",
      eq: { doctor_id: doctorId },
    })
  ).filter((c) => consentStatus(c, now) === "active");
  if (consents.length === 0) return [];
  const patients = await rest.select<{ id: string; full_name: string }>("patients", { columns: "id,full_name" });
  const byId = new Map(patients.map((p) => [p.id, p.full_name]));
  const merged = new Map<string, MyPatient>();
  for (const c of consents) {
    const name = byId.get(c.patient_id);
    if (name === undefined) continue; // o RLS nao devolveu este paciente: nao inventa
    const cur = merged.get(c.patient_id) ?? { id: c.patient_id, full_name: name, categories: [], expires_at: c.expires_at };
    cur.categories = CATEGORIES.filter((k) => cur.categories.includes(k) || c.categories.includes(k));
    if (c.expires_at > cur.expires_at) cur.expires_at = c.expires_at;
    merged.set(c.patient_id, cur);
  }
  return [...merged.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
}

/** Registra que o medico abriu o prontuario (auditoria que o paciente enxerga). Uma linha por categoria liberada.
 *  Sem ler de volta: o medico pode gravar no access_log, mas so o paciente pode le-lo (RLS). */
export async function logAccess(rest: Rest, input: { doctorId: string; patientId: string; categories: Category[] }): Promise<void> {
  for (const category of input.categories) {
    await rest.insert(
      "access_log",
      { doctor_id: input.doctorId, patient_id: input.patientId, category, action: "view" },
      { returning: false },
    );
  }
}
