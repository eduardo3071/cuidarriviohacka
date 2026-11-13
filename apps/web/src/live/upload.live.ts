/**
 * AO VIVO: envio de laudo pela camada de dados do front contra a API LOCAL (uvicorn) e o Supabase real.
 *
 *   python scripts/dev.py --no-api   (nao)   ->   suba a API:  cd apps/api && .venv/Scripts/python -m uvicorn app.main:app --port 8000
 *   cd apps/web && npm run test:live
 *
 * Fluxo real: upload (PDF sintetico da Marta) -> job -> revisao -> rascunho -> confirmar -> aparece no historico.
 * Tudo que cria (documento, job, observacoes, arquivos do storage) e removido no fim e as contagens sao conferidas.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadHealthData, loadRole } from "../data/api";
import { makeApiFetch } from "../data/apiFetch";
import { confirmDocument, getReview, uploadDocument, waitForJob, type ApiFetch } from "../data/documents";
import { supabaseRest, type Rest } from "../data/rest";
import { buildConfirm, toDraft } from "../lib/review";
import { EMAIL, REPO_ROOT, URL_, adminCount, adminHeaders, env, session } from "./helpers";

const API = (env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const EXAM = resolve(REPO_ROOT, "data/synthetic/marta/exams/aurora_2023.pdf");
const pdf = () => new File([readFileSync(EXAM)], "laudo.pdf", { type: "application/pdf" });

describe("envio de laudo ao vivo (API local + Supabase)", () => {
  let patientApi: ApiFetch;
  let doctorApi: ApiFetch;
  let patientRest: Rest;
  let patientId = "";
  const startedAt = new Date(Date.now() - 60_000).toISOString();
  const before = { documents: 0, observations: 0, jobs: 0 };
  let docId = "";

  beforeAll(async () => {
    const health = await fetch(`${API}/health`).catch(() => null);
    if (!health?.ok) throw new Error(`A API local nao responde em ${API}/health. Suba-a antes (uvicorn app.main:app --port 8000).`);
    for (const k of Object.keys(before) as (keyof typeof before)[]) before[k] = await adminCount(k);
    const p = await session(EMAIL.patient);
    const d = await session(EMAIL.doctor);
    patientApi = makeApiFetch(p.client, API);
    doctorApi = makeApiFetch(d.client, API);
    patientRest = supabaseRest(p.client);
    const role = await loadRole(patientRest, p.userId);
    if (role.kind === "patient") patientId = role.patientId;
  });

  afterAll(async () => {
    const rest = (path: string, method = "GET") => fetch(`${URL_}/rest/v1/${path}`, { method, headers: adminHeaders });
    const docs = (await (await rest(`documents?select=id,storage_path,page_paths&patient_id=eq.${patientId}&created_at=gte.${encodeURIComponent(startedAt)}`)).json()) as {
      id: string;
      storage_path: string;
      page_paths: string[] | null;
    }[];
    const ids = docs.map((d) => d.id).join(",");
    if (ids) {
      await rest(`observations?document_id=in.(${ids})`, "DELETE");
      await rest(`jobs?document_id=in.(${ids})`, "DELETE");
      await rest(`documents?id=in.(${ids})`, "DELETE");
    }
    for (const p of docs.flatMap((d) => [d.storage_path, ...(d.page_paths ?? [])])) {
      await fetch(`${URL_}/storage/v1/object/documents/${p}`, { method: "DELETE", headers: adminHeaders });
    }
    for (const k of Object.keys(before) as (keyof typeof before)[]) expect(await adminCount(k), `limpeza: ${k}`).toBe(before[k]);
  });

  it("nao-paciente (medico) e recusado com codigo estavel", async () => {
    await expect(uploadDocument(doctorApi, pdf())).rejects.toMatchObject({ httpStatus: 403, code: "no_patient_profile" });
  });

  it("arquivo que nao e laudo passa na checagem local mas o servidor recusa pelo conteudo (415)", async () => {
    await expect(uploadDocument(patientApi, new File(["isto nao e um pdf"], "falso.pdf", { type: "application/pdf" }))).rejects.toMatchObject({
      httpStatus: 415,
      code: "unsupported_type",
    });
  });

  it("upload -> job -> revisao: 11 leituras com caixa, data e pagina assinada", async () => {
    const up = await uploadDocument(patientApi, pdf());
    expect(up.duplicate).toBe(false);
    docId = up.documentId;
    await waitForJob(patientApi, up.jobId);
    const review = await getReview(patientApi, docId);
    expect(review.method).toBe("text_layer");
    expect(review.observations).toHaveLength(11);
    expect(review.collected_at).toBe("2023-10-17");
    expect(review.observations.every((o) => o.bbox !== null)).toBe(true);
    const page = await fetch(review.pages[0]!.url);
    expect(page.status).toBe(200);
    expect(new Uint8Array(await page.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
  });

  it("reenvio do mesmo arquivo e idempotente (nao cria nada novo)", async () => {
    const again = await uploadDocument(patientApi, pdf());
    expect(again.duplicate).toBe(true);
    expect(again.documentId).toBe(docId);
  });

  it("confirmar: rascunho -> payload -> 11 gravados no historico; repetir devolve already", async () => {
    const histBefore = (await loadHealthData(patientRest, { id: patientId, name: "Marta" }, true)).points.length;
    const review = await getReview(patientApi, docId);
    const built = buildConfirm(toDraft(review));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.observations.every((o) => o.method === "text_layer")).toBe(true); // nada editado = nada "manual"
    expect(await confirmDocument(patientApi, docId, built.payload)).toEqual({ confirmed: 11, submitted: 11, already: false });
    expect((await confirmDocument(patientApi, docId, built.payload)).already).toBe(true);
    const histAfter = (await loadHealthData(patientRest, { id: patientId, name: "Marta" }, true)).points.length;
    expect(histAfter - histBefore).toBe(11);
  });

  it("depois de confirmado, reenviar o mesmo arquivo ainda e duplicado e a revisao responde 409 com codigo", async () => {
    const again = await uploadDocument(patientApi, pdf());
    expect(again).toMatchObject({ duplicate: true, status: "confirmed" });
    await expect(getReview(patientApi, docId)).rejects.toMatchObject({ httpStatus: 409, code: "not_reviewable" });
  });

  it("servidor recusa dado invalido que escapou do front (data no futuro) com 422", async () => {
    await expect(
      confirmDocument(patientApi, docId, { collected_at: "2999-01-01", lab_name: null, observations: [{ raw_name: "x", canonical_name: null, value: 1, unit: null, ref_low: null, ref_high: null, ref_text: null, confidence: null, page: 1, bbox: null, method: "manual", notes: [] }] }),
    ).rejects.toMatchObject({ httpStatus: 422 });
  });
});
