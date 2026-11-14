import { useState } from "react";
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
import { UploadPanel } from "./UploadPanel";

type Step =
  | { k: "idle" }
  | { k: "working"; label: string }
  | { k: "review"; review: Review; draft: Draft; errors: string[]; rowErrors: Record<number, string>; saving: boolean }
  | { k: "done"; result: ConfirmResult | null; duplicate: boolean }
  | { k: "error"; message: string };

const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");

/** Lógica do envio (API e estado). A parte visual fica em UploadPanel. */
export function UploadFlow({ api, onConfirmed, onViewExams }: { api: ApiFetch; onConfirmed: () => void; onViewExams?: () => void }) {
  const [step, setStep] = useState<Step>({ k: "idle" });

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

  const reset = () => setStep({ k: "idle" });

  return (
    <UploadPanel
      step={step.k}
      onFile={(f) => void handleFile(f)}
      onReset={reset}
      onViewExams={onViewExams}
      workingLabel={step.k === "working" ? step.label : undefined}
      errorMessage={step.k === "error" ? step.message : undefined}
      result={step.k === "done" ? step.result : undefined}
      duplicate={step.k === "done" ? step.duplicate : undefined}
      review={
        step.k === "review" ? (
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
        ) : undefined
      }
    />
  );
}
