import { useRef, useState, type DragEvent, type ReactNode } from "react";
import type { ConfirmResult } from "../data/documents";

export type UploadStep = "idle" | "working" | "review" | "done" | "error";

export interface UploadPanelProps {
  step: UploadStep;
  onFile: (file: File) => void;
  onReset: () => void;
  workingLabel?: string;
  errorMessage?: string;
  result?: ConfirmResult | null;
  duplicate?: boolean;
  /** Conteúdo da etapa "review" (o ReviewForm). */
  review?: ReactNode;
}

/** Enviar laudo (puramente visual): escolher arquivo -> lendo -> conferir -> guardado. */
export function UploadPanel({ step, onFile, onReset, workingLabel, errorMessage, result, duplicate, review }: UploadPanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
    if (input.current) input.current.value = ""; // permite escolher o mesmo arquivo de novo
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files);
  };
  const reset = onReset;

  if (step === "review") return <div className="screen">{review}</div>;

  return (
    <div className="screen">
      <section className="panel upload">
        <h2>Enviar laudo</h2>
        <p className="muted">
          Envie um PDF ou uma foto do laudo. O sistema lê os resultados e mostra para você conferir antes de guardar. O que você guardar aparece no seu
          histórico, com a faixa de referência do próprio laudo.
        </p>

        {step === "working" && (
          <p role="status" className="working">
            {workingLabel}
          </p>
        )}
        {step === "error" && (
          <div role="alert" className="form-error">
            <p>{errorMessage}</p>
            <button type="button" className="link" onClick={reset}>
              Tentar de novo
            </button>
          </div>
        )}
        {step === "done" && (
          <div role="status" className="done">
            <p>
              <strong>
                {duplicate
                  ? "Este laudo já foi enviado e guardado antes. Nada foi duplicado."
                  : result?.already
                    ? "Este laudo já estava guardado. Nada mudou."
                    : `${result?.confirmed ?? 0} ${result?.confirmed === 1 ? "resultado guardado" : "resultados guardados"} no seu histórico.`}
              </strong>
            </p>
            {result && result.submitted > result.confirmed && (
              <p className="muted">{result.submitted - result.confirmed} repetido(s) neste laudo foram ignorados.</p>
            )}
            <button type="button" className="primary" onClick={reset}>
              Enviar outro laudo
            </button>
          </div>
        )}

        {(step === "idle" || step === "error") && (
          <label
            className={`dropzone${over ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <span className="dz-button">Escolher arquivo ou tirar foto</span>
            <span className="muted">No computador, também dá para arrastar o arquivo até aqui.</span>
            <span className="muted">PDF, JPEG, PNG ou WebP, até 15 MB</span>
            <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => pick(e.target.files)} />
          </label>
        )}
      </section>
    </div>
  );
}
