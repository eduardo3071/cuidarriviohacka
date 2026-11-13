import { useRef, useState, type DragEvent } from "react";
import {
  confirmDocument,
  getReview,
  uploadDocument,
  waitForJob,
  type ApiFetch,
  type ConfirmResult,
  type Review,
} from "../data/documents";
import { ApiError } from "../data/rest";
import { buildConfirm, toDraft, type Draft } from "../lib/review";
import { ReviewForm } from "./ReviewForm";

type Step =
  | { k: "idle" }
  | { k: "working"; label: string }
  | { k: "review"; review: Review; draft: Draft; errors: string[]; rowErrors: Record<number, string>; saving: boolean }
  | { k: "done"; result: ConfirmResult | null; duplicate: boolean }
  | { k: "error"; message: string };

const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");

/** Enviar laudo -> a API le em segundo plano -> a pessoa confere -> vai para o historico. */
export function UploadPanel({ api, onConfirmed }: { api: ApiFetch; onConfirmed: () => void }) {
  const [step, setStep] = useState<Step>({ k: "idle" });
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function handleFile(file: File) {
    try {
      setStep({ k: "working", label: "Enviando o laudo…" });
      const up = await uploadDocument(api, file);
      if (up.duplicate && up.status === "confirmed") return setStep({ k: "done", result: null, duplicate: true });
      setStep({ k: "working", label: "Lendo o laudo… isso pode levar alguns segundos." });
      await waitForJob(api, up.jobId);
      const review = await getReview(api, up.documentId);
      if (review.observations.length === 0)
        return setStep({ k: "error", message: "Não encontrei resultados de exame neste arquivo. Confira se é um laudo legível e tente outro." });
      setStep({ k: "review", review, draft: toDraft(review), errors: [], rowErrors: {}, saving: false });
    } catch (e) {
      setStep({ k: "error", message: msg(e) });
    }
  }

  async function confirm() {
    if (step.k !== "review") return;
    const built = buildConfirm(step.draft);
    if (!built.ok) return setStep({ ...step, errors: built.errors, rowErrors: built.rowErrors });
    setStep({ ...step, saving: true, errors: [], rowErrors: {} });
    try {
      const result = await confirmDocument(api, step.review.document_id, built.payload);
      setStep({ k: "done", result, duplicate: false });
      onConfirmed();
    } catch (e) {
      setStep({ ...step, saving: false, errors: [msg(e)], rowErrors: {} });
    }
  }

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void handleFile(f);
    if (input.current) input.current.value = ""; // permite escolher o mesmo arquivo de novo
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files);
  };
  const reset = () => setStep({ k: "idle" });

  if (step.k === "review")
    return (
      <div className="app">
        <ReviewForm
          review={step.review}
          draft={step.draft}
          onChange={(draft) => setStep({ ...step, draft })}
          errors={step.errors}
          rowErrors={step.rowErrors}
          busy={step.saving}
          onConfirm={() => void confirm()}
          onCancel={reset}
        />
      </div>
    );

  return (
    <div className="app">
      <section className="panel upload">
        <h2>Enviar laudo</h2>
        <p className="muted">
          Envie um PDF ou uma foto do laudo. O sistema lê os resultados e mostra para você conferir antes de guardar. O que você guardar aparece no seu
          histórico, com a faixa de referência do próprio laudo.
        </p>

        {step.k === "working" && (
          <p role="status" className="working">
            {step.label}
          </p>
        )}
        {step.k === "error" && (
          <div role="alert" className="form-error">
            <p>{step.message}</p>
            <button type="button" className="link" onClick={reset}>
              Tentar de novo
            </button>
          </div>
        )}
        {step.k === "done" && (
          <div role="status" className="done">
            <p>
              <strong>
                {step.duplicate
                  ? "Este laudo já foi enviado e guardado antes. Nada foi duplicado."
                  : step.result?.already
                    ? "Este laudo já estava guardado. Nada mudou."
                    : `${step.result?.confirmed ?? 0} ${step.result?.confirmed === 1 ? "resultado guardado" : "resultados guardados"} no seu histórico.`}
              </strong>
            </p>
            {step.result && step.result.submitted > step.result.confirmed && (
              <p className="muted">{step.result.submitted - step.result.confirmed} repetido(s) neste laudo foram ignorados.</p>
            )}
            <button type="button" className="primary" onClick={reset}>
              Enviar outro laudo
            </button>
          </div>
        )}

        {(step.k === "idle" || step.k === "error") && (
          <label
            className={`dropzone${over ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <span>Arraste o arquivo aqui ou clique para escolher</span>
            <span className="muted">PDF, JPEG, PNG ou WebP, até 15 MB</span>
            <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => pick(e.target.files)} />
          </label>
        )}
      </section>
    </div>
  );
}
