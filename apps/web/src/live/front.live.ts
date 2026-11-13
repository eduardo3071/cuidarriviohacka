/**
 * Verificacao AO VIVO da camada de dados do front com SESSOES REAIS (paciente e medico de demonstracao).
 *
 *   npm run test:live        (dentro de apps/web)
 *
 * Usa o supabase-js com a chave PUBLICAVEL, como o navegador. As sessoes vem do fluxo administrativo de link
 * magico (sem senha), que exige a chave secreta lida do .env da raiz. Nada e impresso: nem chaves, nem tokens.
 * Tudo que o teste cria (consentimentos e linhas de auditoria) e removido no fim, e as contagens sao conferidas.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import { CATEGORIES, grantConsent, listAccessLog, listConsents, listDoctors, listMyPatients, loadHealthData, loadRole, logAccess, revokeConsent } from "../data/api";
import { supabaseRest, type Rest } from "../data/rest";
import { EMAIL, URL_, adminCount, adminHeaders, session } from "./helpers";
describe("front ao vivo (sessoes reais)", () => {
  let patientRest: Rest;
  let doctorRest: Rest;
  let patientId = "";
  let doctorId = "";
  const before = { consents: 0, access_log: 0 };
  const createdConsents: string[] = [];
  const startedAt = new Date(Date.now() - 60_000).toISOString(); // folga para diferenca de relogio com o servidor

  beforeAll(async () => {
    before.consents = await adminCount("consents");
    before.access_log = await adminCount("access_log");
    const p = await session(EMAIL.patient);
    const d = await session(EMAIL.doctor);
    patientRest = supabaseRest(p.client);
    doctorRest = supabaseRest(d.client);
    const pr = await loadRole(patientRest, p.userId);
    const dr = await loadRole(doctorRest, d.userId);
    expect(pr.kind).toBe("patient");
    expect(dr.kind).toBe("doctor");
    if (pr.kind === "patient") patientId = pr.patientId;
    if (dr.kind === "doctor") doctorId = dr.doctorId;
  });

  afterAll(async () => {
    // remove o que o teste criou (como administrador) e confere o estado final
    for (const id of createdConsents) await fetch(`${URL_}/rest/v1/consents?id=eq.${id}`, { method: "DELETE", headers: adminHeaders });
    await fetch(`${URL_}/rest/v1/access_log?doctor_id=eq.${doctorId}&patient_id=eq.${patientId}&accessed_at=gte.${encodeURIComponent(startedAt)}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    expect(await adminCount("consents")).toBe(before.consents);
    expect(await adminCount("access_log")).toBe(before.access_log);
  });

  it("papel: paciente e medico reconhecidos; um medico nao e paciente", async () => {
    expect(patientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(doctorId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await listDoctors(patientRest)).some((d) => d.id === doctorId)).toBe(true);
  });

  it("paciente: carrega TODO o proprio historico, identico ao da demonstracao (paginacao e conversao de tipos)", async () => {
    const d = await loadHealthData(patientRest, { id: patientId, name: "Marta" }, true);
    expect(d.points.length).toBe(demo.points.length);
    expect(d.wearables.length).toBe(demo.wearables.length);
    expect(d.alerts.length).toBe(demo.alerts.length);
    expect(d.events.length).toBe(demo.events.length);
    expect(d.points.every((p) => typeof p.raw_value === "number" && !Number.isNaN(p.raw_value))).toBe(true);
    // mesmo valor normalizado e mesma classificacao que a demonstracao, ponto a ponto
    const key = (p: { collected_at: string; raw_name: string; lab_name: string | null }) => `${p.collected_at.slice(0, 10)}|${p.raw_name}|${p.lab_name}`;
    const demoByKey = new Map(demo.points.map((p) => [key(p), p]));
    for (const p of d.points) {
      const q = demoByKey.get(key(p));
      expect(q, key(p)).toBeDefined();
      expect(p.flag).toBe(q!.flag);
      expect(p.value === null ? null : Math.round(p.value * 1e6)).toBe(q!.value === null ? null : Math.round(q!.value * 1e6));
    }
  });

  it("medico SEM consentimento: nao ve paciente, nem dados, nem consentimentos", async () => {
    expect(await listMyPatients(doctorRest, doctorId)).toEqual([]);
    const d = await loadHealthData(doctorRest, { id: patientId, name: "Marta" }, true);
    expect(d.points).toHaveLength(0);
    expect(d.wearables).toHaveLength(0);
    expect(d.alerts).toHaveLength(0);
    expect(d.events).toHaveLength(0);
  });

  it("medico nao consegue se auto-conceder acesso nem gravar auditoria sem consentimento", async () => {
    await expect(grantConsent(doctorRest, { patientId, doctorId, categories: ["exams"], days: 1 })).rejects.toThrow();
    await expect(logAccess(doctorRest, { doctorId, patientId, categories: ["exams"] })).rejects.toThrow();
  });

  it("paciente concede SO exames: medico ve exames e nada de relogio/alertas; auditoria registrada", async () => {
    const c = await grantConsent(patientRest, { patientId, doctorId, categories: ["exams"], days: 1 });
    createdConsents.push(c.id);

    const mine = await listMyPatients(doctorRest, doctorId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.categories).toEqual(["exams"]);

    await logAccess(doctorRest, { doctorId, patientId, categories: mine[0]!.categories });
    const d = await loadHealthData(doctorRest, { id: patientId, name: mine[0]!.full_name }, true);
    expect(d.points.length).toBe(demo.points.length);
    expect(d.wearables).toHaveLength(0);
    expect(d.alerts).toHaveLength(0);
    expect(d.events.some((e) => e.kind === "alert")).toBe(false);

    const log = await listAccessLog(patientRest, patientId);
    expect(log.some((a) => a.doctor_id === doctorId && a.category === "exams")).toBe(true);
    expect(await listAccessLog(doctorRest, patientId)).toHaveLength(0); // o medico nao le a auditoria
  });

  it("ampliar para relogio libera relogio e alertas; medico nao revoga nem altera o consentimento", async () => {
    const c = await grantConsent(patientRest, { patientId, doctorId, categories: ["wearables"], days: 1 });
    createdConsents.push(c.id);
    const d = await loadHealthData(doctorRest, { id: patientId, name: "Marta" }, true);
    expect(d.wearables.length).toBe(demo.wearables.length);
    expect(d.alerts.length).toBe(demo.alerts.length);

    await expect(revokeConsent(doctorRest, c.id)).rejects.toThrow(); // o RLS devolve 0 linhas
    expect((await listConsents(patientRest, patientId)).find((x) => x.id === c.id)?.revoked_at).toBeNull();
  });

  it("revogar tem efeito imediato: o medico perde a lista e os dados", async () => {
    for (const id of createdConsents) await revokeConsent(patientRest, id); // so os que este teste criou
    expect(await listMyPatients(doctorRest, doctorId)).toEqual([]);
    const d = await loadHealthData(doctorRest, { id: patientId, name: "Marta" }, true);
    expect(d.points).toHaveLength(0);
    expect(d.wearables).toHaveLength(0);
    expect(CATEGORIES.length).toBe(3);
  });
});
