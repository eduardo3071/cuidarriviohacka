import { describe, expect, it, vi } from "vitest";
import { confirmDocument, getReview, uploadDocument, waitForJob, type ConfirmPayload, type Review } from "../data/documents";
import { grantConsent, listAccessLog, listConsents, revokeConsent } from "../data/api";
import type { HealthData, SeriesPoint } from "../types";
import { addExam } from "./addExam";
import { DEMO_PATIENT_ID, makeDemoPrivacyRest } from "./DemoPrivacy";
import { makeDemoApi, type DemoConfirmed } from "./demoApi";

const REVIEW: Review = { document_id: "doc-1", method: "text_layer", lab_name: "Lab X", collected_at: "2026-11-01", warnings: [], observations: [], pages: [] };
const POINT = { biomarker: "Glicemia de jejum", flag: "above", collected_at: "2026-11-01", lab_name: "Lab X" } as SeriesPoint;
const PAYLOAD: ConfirmPayload = {
  collected_at: "2026-11-01",
  lab_name: "Lab X",
  observations: [{ raw_name: "Glicose", canonical_name: null, value: 118, unit: "mg/dL", ref_low: 70, ref_high: 110, ref_text: null, confidence: 1, page: 1, bbox: null, method: "text_layer", notes: [] }],
};
const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const pdf = () => new File([new Uint8Array([1, 2, 3])], "laudo.pdf", { type: "application/pdf" });

function setup(fetchImpl: typeof fetch) {
  const got: DemoConfirmed[] = [];
  return { api: makeDemoApi("http://api", (c) => got.push(c), fetchImpl), got };
}

describe("API de demonstracao (envio de laudo no navegador)", () => {
  it("le o laudo pela API Python e confirma pela normalizacao, sem gravar nada", async () => {
    const f = vi.fn(async (url: string) => (String(url).endsWith("/demo/extract") ? ok(REVIEW) : ok({ confirmed: 1, submitted: 1, points: [POINT] })));
    const { api, got } = setup(f as unknown as typeof fetch);
    const up = await uploadDocument(api, pdf());
    expect(up).toMatchObject({ documentId: "doc-1", duplicate: false });
    await waitForJob(api, up.jobId);
    expect((await getReview(api, up.documentId)).lab_name).toBe("Lab X");
    expect(await confirmDocument(api, up.documentId, PAYLOAD)).toEqual({ confirmed: 1, submitted: 1, already: false });
    expect(got).toHaveLength(1);
    expect(got[0]!.points).toEqual([POINT]);
    expect(f.mock.calls.map((c) => c[0])).toEqual(["http://api/demo/extract", "http://api/demo/normalize"]);
  });

  it("confirmar duas vezes nao duplica as leituras", async () => {
    const { api, got } = setup((async (u: string) => (String(u).endsWith("extract") ? ok(REVIEW) : ok({ confirmed: 1, submitted: 1, points: [POINT] }))) as unknown as typeof fetch);
    const up = await uploadDocument(api, pdf());
    await confirmDocument(api, up.documentId, PAYLOAD);
    expect((await confirmDocument(api, up.documentId, PAYLOAD)).already).toBe(true);
    expect(got).toHaveLength(1);
  });

  it("o mesmo arquivo outra vez e reconhecido como duplicado e nao e lido de novo", async () => {
    const f = vi.fn(async (u: string) => (String(u).endsWith("extract") ? ok(REVIEW) : ok({ confirmed: 1, submitted: 1, points: [POINT] })));
    const { api } = setup(f as unknown as typeof fetch);
    const first = await uploadDocument(api, pdf());
    await confirmDocument(api, first.documentId, PAYLOAD);
    const again = await uploadDocument(api, pdf());
    expect(again).toMatchObject({ duplicate: true, status: "confirmed" });
    expect(f.mock.calls.filter((c) => String(c[0]).endsWith("extract"))).toHaveLength(1);
  });

  it("repassa a mensagem de erro da API e avisa quando a demonstracao esta desligada", async () => {
    const bad = new Response(JSON.stringify({ detail: { code: "no_extractor", message: "Não consegui ler esta foto." } }), { status: 422 });
    await expect(uploadDocument(setup((async () => bad) as unknown as typeof fetch).api, pdf())).rejects.toThrow("Não consegui ler esta foto.");
    const off = setup((async () => new Response("{}", { status: 404 })) as unknown as typeof fetch).api;
    await expect(uploadDocument(off, pdf())).rejects.toThrow(/scripts\/dev\.py/);
  });

  it("API fora do ar vira a mensagem de rede conhecida", async () => {
    const down = setup((async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch).api;
    await expect(uploadDocument(down, pdf())).rejects.toThrow(/dev\.py/);
  });
});

describe("addExam", () => {
  const base = { synthetic: true, patient: { full_name: "M", birth_date: null, sex: null }, points: [], wearables: [], alerts: [],
    events: [{ event_date: "2026-12-01", kind: "exam", title: "B", detail: {} }, { event_date: "2020-01-01", kind: "exam", title: "A", detail: {} }].sort((a, b) => a.event_date.localeCompare(b.event_date)) } as unknown as HealthData;
  it("junta as leituras e o evento em ordem cronologica sem mudar o original", () => {
    const out = addExam(base, { documentId: "d", labName: "Lab X", collectedAt: "2026-11-01", points: [POINT] });
    expect(out.points).toEqual([POINT]);
    expect(out.events.map((e) => e.event_date)).toEqual(["2020-01-01", "2026-11-01", "2026-12-01"]);
    expect(out.events[1]!.detail).toEqual({ document_id: "d", results: 1, out_of_range: 1 });
    expect(base.points).toHaveLength(0);
    expect(base.events).toHaveLength(2);
  });
});

describe("privacidade simulada", () => {
  it("comeca com medicos, um acesso ativo e historico; conceder e revogar funcionam como no real", async () => {
    const rest = makeDemoPrivacyRest();
    expect((await listConsents(rest, DEMO_PATIENT_ID)).filter((c) => !c.revoked_at)).toHaveLength(1);
    expect((await listAccessLog(rest, DEMO_PATIENT_ID)).length).toBeGreaterThan(0);
    const c = await grantConsent(rest, { patientId: DEMO_PATIENT_ID, doctorId: "dr-paulo", categories: ["exams"], days: 30 });
    expect((await listConsents(rest, DEMO_PATIENT_ID)).find((x) => x.id === c.id)?.revoked_at).toBeNull();
    await revokeConsent(rest, c.id);
    expect((await listConsents(rest, DEMO_PATIENT_ID)).find((x) => x.id === c.id)?.revoked_at).toBeTruthy();
    await expect(revokeConsent(rest, c.id)).rejects.toThrow();
    await expect(grantConsent(rest, { patientId: DEMO_PATIENT_ID, doctorId: "dr-paulo", categories: [], days: 30 })).rejects.toThrow();
  });
});
