import { Check } from "lucide-react";
import { Fragment } from "react";

const LABELS = ["Enviar", "Ler", "Conferir"];

/** Indicador dos três passos do envio. `current` = 0, 1, 2; 3 = todos concluídos. */
export function UploadSteps({ current }: { current: number }) {
  return (
    <ol className="up-steps" aria-label="Passos do envio">
      {LABELS.map((l, i) => {
        const state = i < current ? "done" : i === current ? "now" : "next";
        return (
          <Fragment key={l}>
            {i > 0 && <li className="up-wire" aria-hidden="true" />}
            <li className={`up-step is-${state}`} aria-current={state === "now" ? "step" : undefined}>
              <span className="up-dot">{state === "done" ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : i + 1}</span>
              <span className="up-label">{l}<span className="sr-only">{state === "done" ? " (concluído)" : state === "now" ? " (passo atual)" : ""}</span></span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
