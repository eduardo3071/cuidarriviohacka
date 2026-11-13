import { describe, expect, it } from "vitest";
import { confirmDocument, getReview, toApiError, uploadDocument, validateFile, waitForJob, type ApiFetch } from "./documents";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("validateFile", () => {
  it("aceita PDF e imagens, recusa o resto, vazio e grande", () => {
    expect(validateFile({ name: "laudo.PDF", size: 10 })).toBeNull();
    expect(validateFile({ name: "foto.jpeg", size: 10 })).toBeNull();
    expect(validateFile({ name: "x.webp", size: 10 })).toBeNull();
    expect(validateFile({ name: "x.docx", size: 10 })).toMatch(/PDF/);
    expect(validateFile({ name: "x.pdf", size: 0 })).toMatch(/vazio/);
    expect(validateFile({ name: "x.pdf", size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
  });
});

describe("toApiError", () => {
  it("usa a mensagem e o codigo estaveis do servidor", async () => {
    const e = await toApiError(json({ detail: { code: "unsupported_type", message: "Envie um PDF." } }, 415));
    expect(e.message).toBe("Envie um PDF.");
    expect(e.code).toBe("unsupported_type");
    expect(e.httpStatus).toBe(415);
  });
  it("erro de validacao do FastAPI (lista) e corpo nao-JSON caem em mensagem em portugues", async () => {
    expect((await toApiError(json({ detail: [{ msg: "x" }] }, 422))).message).toMatch(/validação/);
    expect((await toApiError(new Response("<html>", { status: 503 }))).message).toMatch(/indisponível/);
    expect((await toApiError(new Response("", { status: 418 }))).message).toMatch(/418/);
  });
});

describe("uploadDocument", () => {
  it("envia multipart no campo 'file' e converte a resposta", async () => {
    let seen: { path: string; init?: RequestInit } | null = null;
    const api: ApiFetch = async (path, init) => {
      seen = { path, init };
      return json({ document_id: "d1", job_id: "j1", status: "processing", duplicate: false }, 202);
    };
    const r = await uploadDocument(api, new File(["%PDF-1.4"], "laudo.pdf", { type: "application/pdf" }));
    expect(r).toEqual({ documentId: "d1", jobId: "j1", status: "processing", duplicate: false });
    expect(seen!.path).toBe("/documents");
    expect(seen!.init?.method).toBe("POST");
    expect((seen!.init?.body as FormData).get("file")).toBeInstanceOf(File);
    expect(seen!.init?.headers).toBeUndefined(); // o navegador define o Content-Type com o boundary
  });
  it("nao chama a rede com arquivo invalido", async () => {
    let calls = 0;
    const api: ApiFetch = async () => (calls++, json({}));
    await expect(uploadDocument(api, new File(["x"], "a.txt"))).rejects.toMatchObject({ code: "invalid_file" });
    expect(calls).toBe(0);
  });
  it("API fora do ar vira mensagem util, com codigo 'network'", async () => {
    const api: ApiFetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(uploadDocument(api, new File(["%PDF"], "a.pdf"))).rejects.toMatchObject({ code: "network", message: expect.stringMatching(/dev\.py/) });
  });
});

describe("waitForJob", () => {
  const sequence = (statuses: object[]): ApiFetch => {
    let i = 0;
    return async () => json(statuses[Math.min(i++, statuses.length - 1)]);
  };
  const fast = { sleep: async () => {}, intervalMs: 1 };

  it("espera ate terminar", async () => {
    await expect(waitForJob(sequence([{ status: "queued" }, { status: "running" }, { status: "succeeded" }]), "j", fast)).resolves.toBeUndefined();
  });
  it("job que falhou leva o codigo e o motivo", async () => {
    await expect(waitForJob(sequence([{ status: "running" }, { status: "failed", error_code: "no_text", error: "sem texto" }]), "j", fast)).rejects.toMatchObject({
      code: "no_text",
      message: expect.stringContaining("sem texto"),
    });
  });
  it("desiste no tempo limite (relogio injetado, sem esperar de verdade)", async () => {
    let t = 0;
    await expect(waitForJob(sequence([{ status: "running" }]), "j", { sleep: async () => void (t += 1000), now: () => t, timeoutMs: 5000 })).rejects.toMatchObject({
      code: "timeout",
    });
  });
});

describe("getReview / confirmDocument", () => {
  it("revisao de documento nao pronto repassa 409 com o codigo", async () => {
    const api: ApiFetch = async () => json({ detail: { code: "not_reviewable", message: "O documento esta 'processing'." } }, 409);
    await expect(getReview(api, "d1")).rejects.toMatchObject({ code: "not_reviewable", httpStatus: 409 });
  });
  it("confirmacao envia JSON e devolve o resultado", async () => {
    let sent: RequestInit | undefined;
    const api: ApiFetch = async (_p, init) => ((sent = init), json({ confirmed: 2, submitted: 2, already: false }));
    const out = await confirmDocument(api, "d1", { collected_at: "2026-01-01", lab_name: null, observations: [] });
    expect(out.confirmed).toBe(2);
    expect((sent!.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(sent!.body as string).collected_at).toBe("2026-01-01");
  });
});
