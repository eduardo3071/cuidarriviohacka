import type { Flag } from "../types";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const fmtNum = (n: number): string => nf.format(n);

/** "2016-05-10" -> "10/05/2016" (sem passar por Date: nada de fuso horario). */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Faixa em texto, sem inventar nada: limite so em um lado vira "ate X" / "a partir de X". */
export function fmtRange(low: number | null, high: number | null, unit: string | null): string | null {
  const u = unit ? ` ${unit}` : "";
  if (low !== null && high !== null) return `${fmtNum(low)}–${fmtNum(high)}${u}`;
  if (high !== null) return `até ${fmtNum(high)}${u}`;
  if (low !== null) return `a partir de ${fmtNum(low)}${u}`;
  return null;
}

export const FLAG_LABEL: Record<Flag, string> = {
  in_range: "Dentro da faixa do laudo",
  above: "Acima da faixa do laudo",
  below: "Abaixo da faixa do laudo",
  no_range: "Laudo sem faixa de referência",
};

export const FLAG_SHORT: Record<Flag, string> = {
  in_range: "na faixa",
  above: "acima",
  below: "abaixo",
  no_range: "sem faixa",
};

/** As categorias da ontologia estao sem acento; aqui ficam bonitas. */
const CATEGORY_LABEL: Record<string, string> = {
  Lipidios: "Lipídios",
  "Funcao renal": "Função renal",
  Figado: "Fígado",
  Inflamacao: "Inflamação",
  Eletrolitos: "Eletrólitos",
};

export const categoryLabel = (c: string | null): string => (c ? (CATEGORY_LABEL[c] ?? c) : "Outros");

/** O unico "separador de variacao" que a tela usa: sinal explicito e virgula decimal. */
export function fmtPercent(p: number): string {
  const s = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(p);
  return `${s}%`;
}
