import { ArrowLeftRight, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "../components/ui";
import type { TourStep } from "./steps";
import "./pitch.css";

export type Corner = "direita" | "esquerda";

export interface TourPanelProps {
  step: TourStep;
  index: number;
  total: number;
  collapsed: boolean;
  corner: Corner;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  onToggle: () => void;
  onMove: () => void;
}

/** Painel do apresentador: diz o que falar em cada passo e deixa avançar, voltar, recolher ou sair. */
export function TourPanel({ step, index, total, collapsed, corner, onPrev, onNext, onExit, onToggle, onMove }: TourPanelProps) {
  const last = index === total - 1;
  return (
    <aside className={`tour tour-${corner}${collapsed ? " tour-collapsed" : ""}`} role="region" aria-label="Apresentação guiada" aria-live="polite">
      <header className="tour-head">
        <span className="tour-count">Passo {index + 1} de {total}</span>
        <span className="tour-etapa">{step.etapa}</span>
        <span className="tour-tools">
          <button type="button" className="tour-icon tour-move" onClick={onMove} aria-label={corner === "direita" ? "Mover o painel para a esquerda" : "Mover o painel para a direita"}>
            <ArrowLeftRight size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" className="tour-icon" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expandir o painel" : "Recolher o painel"}>
            {collapsed ? <ChevronUp size={20} strokeWidth={1.75} aria-hidden="true" /> : <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <button type="button" className="tour-icon" onClick={onExit} aria-label="Sair da apresentação">
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </span>
      </header>

      {!collapsed && (
        <>
          <h2 className="tour-title">{step.title}</h2>
          <p className="tour-fala">{step.fala}</p>
          {step.gargalo && (
            <p className="tour-gargalo"><strong>Gargalo que resolve:</strong> {step.gargalo}</p>
          )}
          <ol className="tour-dots" aria-label={`Progresso: passo ${index + 1} de ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <li key={i} className={i < index ? "done" : i === index ? "cur" : undefined} aria-current={i === index ? "step" : undefined} />
            ))}
          </ol>
          <footer className="tour-actions">
            <Button variant="link" onClick={onPrev} disabled={index === 0}>Voltar</Button>
            <Button onClick={last ? onExit : onNext}>{last ? "Concluir" : "Próximo"}</Button>
          </footer>
        </>
      )}
    </aside>
  );
}
