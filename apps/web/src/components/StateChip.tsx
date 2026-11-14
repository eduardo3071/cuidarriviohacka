import { ArrowDown, ArrowUp, Check, Minus } from "lucide-react";
import type { Flag } from "../types";
import { RANGE_LABEL } from "../lib/safetyCopy";
import { fmtNum } from "../lib/format";

const ICON = { above: ArrowUp, below: ArrowDown, in_range: Check, no_range: Minus } as const;
const SHORT: Record<Flag, string> = { above: "Acima", below: "Abaixo", in_range: "Dentro", no_range: "Sem faixa" };

/** Chip de estado: ícone + texto (cor nunca é o único sinal). "short" para listas, completo no detalhe. */
export function StateChip({ flag, short = false }: { flag: Flag; short?: boolean }) {
  const Icon = ICON[flag];
  return (
    <span className={`state-badge state-badge-${flag}`} title={RANGE_LABEL[flag]}>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      {short ? <><span aria-hidden="true">{SHORT[flag]}</span><span className="sr-only">{RANGE_LABEL[flag]}</span></> : RANGE_LABEL[flag]}
    </span>
  );
}

/** "70 a 110" — só com os limites impressos no laudo. */
export function rangeText(low: number | null, high: number | null): string | null {
  if (low != null && high != null) return `${fmtNum(low)} a ${fmtNum(high)}`;
  if (high != null) return `até ${fmtNum(high)}`;
  if (low != null) return `a partir de ${fmtNum(low)}`;
  return null;
}
