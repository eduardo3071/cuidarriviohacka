import { describe, expect, it } from "vitest";
import { FakeRest } from "../test/fakeRest";
import {
  consentStatus,
  grantConsent,
  listMyPatients,
  loadHealthData,
  loadRole,
  logAccess,
  revokeConsent,
} from "./api";
import { selectAll } from "./rest";

const NOW = new Date("2026-11-12T12:00:00Z");
const iso = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

describe("loadRole", () => {
  const db = () =>
    new FakeRest({
      patients: [{ id: "p1", user_id: "u1", full_name: "Marta", birth_date: "1980-01-01", sex: "F" }],
      doctors: [{ id: "d1", user_id: "u2", full_name: "Dr. Caio" }],
    });
  it("reconhece paciente, medico e desconhecido", async () => {
    expect(await loadRole(db(), "u1")).toMatchObject({ kind: "patient", patientId: "p1", name: "Marta" });
    expect(await loadRole(db(), "u2")).toMatchObject({ kind: "doctor", doctorId: "d1" });
    expect(await loadRole(db(), "u3")).toEqual({ kind: "none" });
  });
});

describe("selectAll", () => {
  it("pagina ate acabar, inclusive quando o total e multiplo da pagina", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ n: String(i) }));
    const rest = new FakeRest({ t: rows });
    const all = await selectAll<{ n: string }>(rest, "t", { order: [{ column: "n" }] }, 3);
    expect(all.map((r) => r.n)).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(rest.calls.length).toBe(3); // 3 + 3 + pagina vazia
  });
});

describe("loadHealthData", () => {
  it("converte numericos que o PostgREST devolve como string e filtra pelo paciente", async () => {
    const rest = new FakeRest({
      observation_series: [
        { patient_id: "p1", biomarker: "glucose", collected_at: "2026-01-01", raw_name: "Glicose", raw_value: "95.5", raw_ref_low: "70", raw_ref_high: "99", value: "95.5", ref_low: "70", ref_high: "99", flag: "normal", normalization: "ok" },
        { patient_id: "p2", biomarker: "glucose", collected_at: "2026-01-01", raw_name: "Glicose", raw_value: "300", flag: "high" },
      ],
      timeline_events: [{ patient_id: "p1", event_date: "2026-01-01", kind: "exam", title: "x", detail: null }],
      wearable_samples: [{ patient_id: "p1", recorded_at: "2026-01-01T00:00:00Z", metric: "hr", value: "61", unit: "bpm" }],
      alerts: [],
    });
    const d = await loadHealthData(rest, { id: "p1", name: "Marta" }, true);
    expect(d.points).toHaveLength(1);
    expect(d.points[0]?.raw_value).toBe(95.5);
    expect(d.points[0]?.ref_high).toBe(99);
    expect(d.points[0]?.raw_ref_low).toBe(70);
    expect(d.wearables[0]).toEqual({ t: "2026-01-01T00:00:00Z", metric: "hr", value: 61, unit: "bpm" });
    expect(d.events).toHaveLength(1);
    expect(d.synthetic).toBe(true);
  });
  it("categoria bloqueada pelo RLS (tabela vazia) vira lista vazia, sem erro", async () => {
    const d = await loadHealthData(new FakeRest({}), { id: "p1", name: "Marta" }, false);
    expect(d.points).toEqual([]);
    expect(d.alerts).toEqual([]);
  });
});

describe("consentStatus", () => {
  it("revogado ganha de tudo e o instante do vencimento ja esta vencido", () => {
    expect(consentStatus({ revoked_at: iso(-1), expires_at: iso(10) }, NOW)).toBe("revoked");
    expect(consentStatus({ revoked_at: null, expires_at: NOW.toISOString() }, NOW)).toBe("expired");
    expect(consentStatus({ revoked_at: null, expires_at: iso(1) }, NOW)).toBe("active");
  });
});

describe("grantConsent / revokeConsent", () => {
  it("valida entradas antes de falar com o banco", async () => {
    const rest = new FakeRest();
    const base = { patientId: "p1", doctorId: "d1", categories: ["exams" as const], days: 30, now: NOW };
    await expect(grantConsent(rest, { ...base, categories: [] })).rejects.toThrow(/pelo menos uma/);
    await expect(grantConsent(rest, { ...base, days: 0 })).rejects.toThrow(/duração/);
    await expect(grantConsent(rest, { ...base, days: 366 })).rejects.toThrow(/duração/);
    await expect(grantConsent(rest, { ...base, days: 1.5 })).rejects.toThrow(/duração/);
    await expect(grantConsent(rest, { ...base, categories: ["x" as never] })).rejects.toThrow(/inválida/);
    expect(rest.calls).toHaveLength(0);
  });
  it("grava categorias sem duplicar e vencimento correto", async () => {
    const rest = new FakeRest();
    const c = await grantConsent(rest, { patientId: "p1", doctorId: "d1", categories: ["exams", "exams", "wearables"], days: 30, now: NOW });
    expect(c.categories).toEqual(["exams", "wearables"]);
    expect(c.expires_at).toBe(iso(30));
  });
  it("revoga uma vez; a segunda falha com mensagem clara", async () => {
    const rest = new FakeRest({ consents: [{ id: "c1", revoked_at: null }] });
    await revokeConsent(rest, "c1", NOW);
    expect(rest.rows("consents")[0]?.revoked_at).toBe(NOW.toISOString());
    await expect(revokeConsent(rest, "c1", NOW)).rejects.toThrow(/não foi possível revogar/i);
    await expect(revokeConsent(rest, "nao-existe", NOW)).rejects.toThrow();
  });
});

describe("listMyPatients", () => {
  const consent = (over: Record<string, unknown>) => ({
    id: "c", patient_id: "p1", doctor_id: "d1", categories: ["exams"], granted_at: iso(-5), expires_at: iso(10), revoked_at: null, ...over,
  });
  const patients = [
    { id: "p1", full_name: "Marta" },
    { id: "p2", full_name: "Ana" },
  ];
  it("so mostra consentimentos ativos e une categorias e vencimento", async () => {
    const rest = new FakeRest({
      patients,
      consents: [
        consent({ id: "a", categories: ["exams"], expires_at: iso(5) }),
        consent({ id: "b", categories: ["wearables"], expires_at: iso(20) }),
        consent({ id: "c", patient_id: "p2", revoked_at: iso(-1) }),
        consent({ id: "d", patient_id: "p2", expires_at: iso(-1) }),
        consent({ id: "e", doctor_id: "outro" }),
      ],
    });
    const out = await listMyPatients(rest, "d1", NOW);
    expect(out).toEqual([{ id: "p1", full_name: "Marta", categories: ["exams", "wearables"], expires_at: iso(20) }]);
  });
  it("lista vazia sem consentimento e nao busca pacientes", async () => {
    const rest = new FakeRest({ patients, consents: [] });
    expect(await listMyPatients(rest, "d1", NOW)).toEqual([]);
    expect(rest.calls.some((c) => c.table === "patients")).toBe(false);
  });
  it("ignora paciente que o RLS nao devolveu", async () => {
    const rest = new FakeRest({ patients: [], consents: [consent({})] });
    expect(await listMyPatients(rest, "d1", NOW)).toEqual([]);
  });
});

describe("logAccess", () => {
  it("grava uma linha por categoria liberada", async () => {
    const rest = new FakeRest();
    await logAccess(rest, { doctorId: "d1", patientId: "p1", categories: ["exams", "wearables"] });
    expect(rest.rows("access_log").map((r) => r.category)).toEqual(["exams", "wearables"]);
    expect(rest.rows("access_log").every((r) => r.action === "view")).toBe(true);
    // o medico nao tem permissao de leitura no access_log: nunca pode pedir a linha de volta
    expect(rest.calls.filter((c) => c.op === "insert").every((c) => (c.detail as { options: { returning?: boolean } }).options.returning === false)).toBe(true);
  });
});
