import { ApiError } from "./rest";

/** fetch ja apontado para a API e com o token do usuario (montado no Root; nos testes e um falso). */
export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export interface ReviewObservation {
  raw_name: string;
  canonical_name: string | null;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  page: number;
  bbox: [number, number, number, number] | null;
  confidence: number | null;
  notes: string[];
  method: "text_layer" | "ocr" | "llm" | null;
}
export interface Review {
  document_id: string;
  method: string;
  lab_name: string | null;
  collected_at: string | null;
  warnings: string[];
  observations: ReviewObservation[];
  pages: { page: number; url: string }[];
}
export interface UploadResult {
  documentId: string;
  jobId: string;
  status: string;
  duplicate: boolean;
}
export interface ConfirmObservation {
  raw_name: string;
  canonical_name: string | null;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  confidence: number | null;
  page: number;
  bbox: [number, number, number, number] | null;
  method: "text_layer" | "ocr" | "llm" | "manual";
  notes: string[];
}
export interface ConfirmPayload {
  collected_at: string;
  lab_name: string | null;
  observations: ConfirmObservation[];
}
export interface ConfirmResult {
  confirmed: number;
  submitted: number;
  already: boolean;
}

export const MAX_UPLOAD_MB = 15; // o servidor e quem manda (MAX_UPLOAD_MB); aqui so evita subir arquivo que ele recusaria
const ALLOWED = /\.(pdf|jpe?g|png|webp)$/i;

/** Confere antes de gastar rede. O servidor confere de novo pelo conteudo real do arquivo. */
export function validateFile(file: { name: string; size: number }): string | null {
  if (!ALLOWED.test(file.name)) return "Envie um PDF, JPEG, PNG ou WebP.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `O arquivo passa de ${MAX_UPLOAD_MB} MB.`;
  return null;
}

const STATUS_FALLBACK: Record<number, string> = {
  401: "Sua sessão expirou. Entre de novo.",
  403: "Esta conta não tem perfil de paciente.",
  413: "O arquivo é grande demais.",
  415: "Envie um PDF, JPEG, PNG ou WebP.",
  422: "Os dados enviados não passaram na validação.",
  502: "O armazenamento está indisponível agora. Tente de novo.",
  503: "O serviço está indisponível agora. Tente de novo em instantes.",
};

/** Resposta de erro da API -> ApiError com a mensagem pronta para mostrar. O `code` e estavel; a mensagem vem do servidor. */
export async function toApiError(res: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    detail = ((await res.json()) as { detail?: unknown }).detail;
  } catch {
    /* corpo nao e JSON */
  }
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as { code?: string; message?: string };
    if (d.message) return new ApiError(d.message, d.code, res.status);
  }
  return new ApiError(STATUS_FALLBACK[res.status] ?? `Erro do servidor (${res.status}).`, undefined, res.status);
}

async function call(api: ApiFetch, path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await api(path, init);
  } catch {
    throw new ApiError("Não consegui falar com a API de laudos. Ela está rodando (python scripts/dev.py)?", "network");
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

export async function uploadDocument(api: ApiFetch, file: File): Promise<UploadResult> {
  const invalid = validateFile(file);
  if (invalid) throw new ApiError(invalid, "invalid_file");
  const body = new FormData();
  body.append("file", file);
  const j = (await (await call(api, "/documents", { method: "POST", body })).json()) as {
    document_id: string;
    job_id: string;
    status: string;
    duplicate: boolean;
  };
  return { documentId: j.document_id, jobId: j.job_id, status: j.status, duplicate: j.duplicate };
}

export interface WaitOptions {
  intervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Acompanha o job ate terminar. A extracao roda em segundo plano e o OCR pode levar 10 s ou mais por pagina. */
export async function waitForJob(api: ApiFetch, jobId: string, opt: WaitOptions = {}): Promise<void> {
  const { intervalMs = 1500, timeoutMs = 180_000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = opt;
  const start = now();
  for (;;) {
    const job = (await (await call(api, `/jobs/${jobId}`)).json()) as { status: string; error_code?: string | null; error?: string | null };
    if (job.status === "succeeded") return;
    if (job.status === "failed")
      throw new ApiError(
        "Não foi possível ler este laudo automaticamente." + (job.error ? ` (${job.error})` : ""),
        job.error_code ?? "job_failed",
      );
    if (now() - start >= timeoutMs) throw new ApiError("A leitura está demorando mais que o normal. Tente de novo em instantes.", "timeout");
    await sleep(intervalMs);
  }
}

export async function getReview(api: ApiFetch, documentId: string): Promise<Review> {
  return (await (await call(api, `/documents/${documentId}/review`)).json()) as Review;
}

export async function confirmDocument(api: ApiFetch, documentId: string, payload: ConfirmPayload): Promise<ConfirmResult> {
  const res = await call(api, `/documents/${documentId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as ConfirmResult;
}
