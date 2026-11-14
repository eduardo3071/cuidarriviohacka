import { AlertCircle, Camera, Check, Lightbulb, Upload } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { ConfirmResult } from "../data/documents";
import { SAFETY_COPY } from "../lib/safetyCopy";
import { UploadSteps } from "./UploadSteps";
import { Button, StateBadge } from "./ui";
import "./upload.css";

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
  /** Leva para a aba Exames depois de guardar. */
  onViewExams?: () => void;
  /** Só para a vitrine /celular: abre direto a prévia de uma foto. */
  initialPhoto?: string;
}

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";
const FORMATS = "PDF, JPEG, PNG ou WebP, até 15 MB";
const STEP_INDEX: Record<UploadStep, number> = { idle: 0, error: 0, working: 1, review: 2, done: 3 };

/** Enviar laudo (puramente visual): escolher arquivo -> lendo -> conferir -> guardado. */
export function UploadPanel({ step, onFile, onReset, workingLabel, errorMessage, result, duplicate, review, onViewExams, initialPhoto }: UploadPanelProps) {
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  // foto da câmera: primeiro a prévia, depois "Usar esta foto" ou "Tirar outra"
  const [photo, setPhoto] = useState<{ file: File | null; url: string } | null>(initialPhoto ? { file: null, url: initialPhoto } : null);
  useEffect(() => () => { if (photo?.file) URL.revokeObjectURL(photo.url); }, [photo]);
  const shoot = (input: HTMLInputElement | null) => {
    const f = input?.files?.[0];
    if (f) setPhoto({ file: f, url: URL.createObjectURL(f) });
    if (input) input.value = "";
  };
  const usePhoto = () => { if (photo?.file) onFile(photo.file); setPhoto(null); };
  const pick = (input: HTMLInputElement | null) => {
    const f = input?.files?.[0];
    if (f) onFile(f);
    if (input) input.value = ""; // permite escolher o mesmo arquivo de novo
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };
  const repeated = duplicate || result?.already;
  const n = result?.confirmed ?? 0;

  return (
    <main className="screen up-screen">
      <h2 className="page-title">Enviar laudo</h2>
      <UploadSteps current={STEP_INDEX[step]} />

      {step === "review" && review}

      {(step === "idle" || step === "error") && photo && (
        <div className="up-photo">
          <h3 className="sec-title">Confira a foto</h3>
          <img src={photo.url} alt="Prévia da foto do laudo" className="up-photo-img" />
          <p className="caption">Veja se a página inteira aparece e se dá para ler os números.</p>
          <div className="up-photo-actions">
            <Button className="up-big" icon={Check} onClick={usePhoto}>Usar esta foto</Button>
            <Button className="up-big" variant="secondary" icon={Camera} onClick={() => camera.current?.click()}>Tirar outra</Button>
          </div>
        </div>
      )}
      {(step === "idle" || step === "error") && (
        <input ref={camera} className="sr-only" tabIndex={-1} aria-hidden="true" type="file" accept="image/*" capture="environment" onChange={(e) => shoot(e.currentTarget)} />
      )}

      {(step === "idle" || step === "error") && !photo && (
        <div className="up-pick">
          <p className="up-lead">{SAFETY_COPY.upload}</p>
          {step === "error" && (
            <div role="alert" className="up-error">
              <AlertCircle size={24} strokeWidth={1.75} aria-hidden="true" />
              <div>
                <p>{errorMessage}</p>
                <Button variant="secondary" onClick={onReset}>Tentar de novo</Button>
              </div>
            </div>
          )}
          <div className="up-mobile">
            <Button className="up-big" icon={Camera} onClick={() => camera.current?.click()}>Fotografar o laudo</Button>
            <Button className="up-big" variant="secondary" onClick={() => file.current?.click()}>Escolher arquivo (PDF ou imagem)</Button>
            <p className="caption up-center">{FORMATS}</p>
          </div>
          <div
            className={`up-drop${over ? " is-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            onClick={(e) => { if (e.target === e.currentTarget) file.current?.click(); }}
          >
            <Upload size={40} strokeWidth={1.75} aria-hidden="true" />
            <p className="up-drop-title">Arraste o arquivo aqui ou clique para escolher</p>
            <p className="caption">{FORMATS}</p>
            <Button variant="secondary" onClick={() => file.current?.click()}>Escolher arquivo</Button>
          </div>
          <div className="up-tip">
            <Lightbulb size={20} strokeWidth={1.75} aria-hidden="true" />
            <p>Dica de foto: boa luz, a página inteira, sem sombra.</p>
          </div>
          <input ref={file} className="sr-only" tabIndex={-1} aria-hidden="true" type="file" accept={ACCEPT} onChange={(e) => pick(e.currentTarget)} />
        </div>
      )}

      {step === "working" && (
        <div className="up-reading">
          <span className="up-spinner" aria-hidden="true" />
          <p role="status" className="up-reading-title">{workingLabel}</p>
          <div className="up-skel" aria-hidden="true"><span /><span /><span /></div>
          <Button variant="link" onClick={onReset}>Cancelar</Button>
        </div>
      )}

      {step === "done" && (
        repeated ? (
          <div role="status" className="ds-card up-done">
            <StateBadge state="info" label="Já enviado" />
            <p>{SAFETY_COPY.duplicate}</p>
            {onViewExams && <Button variant="secondary" onClick={onViewExams}>Ver nos meus exames</Button>}
            <Button variant="link" onClick={onReset}>Enviar outro</Button>
          </div>
        ) : (
          <div role="status" className="ds-card up-done">
            <span className="up-ok"><Check size={32} strokeWidth={2} aria-hidden="true" /></span>
            <h3 className="sec-title">{n} {n === 1 ? "resultado guardado" : "resultados guardados"}</h3>
            <p className="caption">
              Já estão no seu histórico, com a faixa impressa no próprio laudo.
              {result && result.submitted > result.confirmed && ` ${result.submitted - result.confirmed} repetido(s) neste laudo foram ignorados.`}
            </p>
            {onViewExams && <Button onClick={onViewExams}>Ver nos meus exames</Button>}
            <Button variant="link" onClick={onReset}>Enviar outro</Button>
          </div>
        )
      )}
    </main>
  );
}
