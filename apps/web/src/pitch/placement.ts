import type { Corner } from "./TourPanel";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const area = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * No computador, escolhe o canto (direita ou esquerda, no pé da tela) em que o painel cobre MENOS o que está destacado.
 * No celular o painel é uma folha de baixo, então nada muda. Empate: mantém o canto atual (não fica pulando de lado).
 */
export function pickCorner(
  target: Box,
  view: { w: number; h: number },
  panel: { w: number; h: number },
  current: Corner,
  layout: { sidebar: number; margin: number } = { sidebar: 248, margin: 24 },
): Corner {
  if (view.w < 1024) return current;
  const at = (left: number): Box => ({ left, right: left + panel.w, top: view.h - layout.margin - panel.h, bottom: view.h - layout.margin });
  const right = area(target, at(view.w - layout.margin - panel.w));
  const left = area(target, at(layout.sidebar + layout.margin));
  if (right === left) return current;
  return left < right ? "esquerda" : "direita";
}
