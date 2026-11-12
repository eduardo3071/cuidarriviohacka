import { useEffect, useRef, useState } from "react";

/** Largura real do container, para desenhar o SVG em pixels de verdade (a fonte dos eixos nao encolhe no
 *  celular). Antes de o navegador medir (e na renderizacao em servidor, nos testes) vale `fallback`. */
export function useWidth(fallback = 760, min = 240) {
  const ref = useRef<HTMLElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = (px: number) => setW(Math.max(min, Math.round(px)));
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => entry && apply(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w] as const;
}
