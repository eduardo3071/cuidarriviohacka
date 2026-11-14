import type { ApiFetch, ConfirmPayload, ConfirmResult, Review } from "../data/documents";
import type { SeriesPoint } from "../types";

export interface DemoConfirmed {
  documentId: string;
  labName: string | null;
  collectedAt: string;
  points: SeriesPoint[];
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, code: string, message: string) => json(status, { detail: { code, message } });

async function fingerprint(file: File): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${file.name}:${file.size}:${file.lastModified}`; // contexto sem crypto.subtle
  }
}

/** `ApiFetch` falso para a tela de demonstracao (sem conta). Fala o mesmo contrato do envio normal
 *  (/documents, /jobs, review, confirm), mas por tras chama as rotas abertas /demo/extract e /demo/normalize da API
 *  Python: a LEITURA do laudo (texto do PDF, OCR e OpenCV) e real; nada e gravado no servidor.
 *  As leituras confirmadas voltam por `onConfirmed` e ficam so na memoria do navegador. */
export function makeDemoApi(baseUrl: string, onConfirmed: (c: DemoConfirmed) => void, fetchImpl: typeof fetch = (...a) => fetch(...a)): ApiFetch {
  const reviews = new Map<string, Review>();
  const byFile = new Map<string, string>(); // impressao digital -> documento
  const confirmed = new Set<string>();

  return async (path, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();

    if (method === "POST" && path === "/documents") {
      const file = (init.body as FormData).get("file");
      if (!(file instanceof File)) return fail(422, "empty_file", "Escolha um arquivo.");
      const fp = await fingerprint(file);
      const known = byFile.get(fp);
      if (known) {
        const done = confirmed.has(known);
        return json(200, { document_id: known, job_id: known, status: done ? "confirmed" : "succeeded", duplicate: true });
      }
      const form = new FormData();
      form.append("file", file);
      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/demo/extract`, { method: "POST", body: form });
      } catch {
        throw new Error("network"); // o front traduz em "API fora do ar"
      }
      if (res.status === 404)
        return fail(503, "demo_off", "A leitura de demonstração não está ligada neste servidor. Rode python scripts/dev.py.");
      if (!res.ok) return res; // mesmo formato {detail:{code,message}}, ja com a mensagem pronta
      const review = (await res.json()) as Review;
      reviews.set(review.document_id, review);
      byFile.set(fp, review.document_id);
      return json(200, { document_id: review.document_id, job_id: review.document_id, status: "queued", duplicate: false });
    }

    const job = path.match(/^\/jobs\/([^/]+)$/);
    if (method === "GET" && job) return json(200, { status: "succeeded" }); // a leitura ja terminou no envio

    const rev = path.match(/^\/documents\/([^/]+)\/review$/);
    if (method === "GET" && rev) {
      const r = reviews.get(rev[1]!);
      return r ? json(200, r) : fail(404, "not_found", "Documento não encontrado.");
    }

    const conf = path.match(/^\/documents\/([^/]+)\/confirm$/);
    if (method === "POST" && conf) {
      const id = conf[1]!;
      const review = reviews.get(id);
      if (!review) return fail(404, "not_found", "Documento não encontrado.");
      const payload = JSON.parse(String(init.body)) as ConfirmPayload;
      if (confirmed.has(id)) return json(200, { confirmed: payload.observations.length, submitted: payload.observations.length, already: true } satisfies ConfirmResult);
      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/demo/normalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } catch {
        throw new Error("network");
      }
      if (!res.ok) return res;
      const out = (await res.json()) as { confirmed: number; submitted: number; points: SeriesPoint[] };
      confirmed.add(id);
      onConfirmed({ documentId: id, labName: payload.lab_name, collectedAt: payload.collected_at, points: out.points });
      return json(200, { confirmed: out.confirmed, submitted: out.submitted, already: false } satisfies ConfirmResult);
    }

    return fail(404, "not_found", "Rota inexistente na demonstração.");
  };
}
