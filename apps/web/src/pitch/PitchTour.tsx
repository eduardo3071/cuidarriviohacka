import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ScreenPreview } from "../celular/ScreenPreview";
import demo from "../demo/marta.json";
import type { HealthData } from "../types";
import { pickCorner } from "./placement";
import { TourPanel, type Corner } from "./TourPanel";
import { buildSteps, initialTour, keyToAction, tourReducer, type TourAction } from "./steps";
import "./pitch.css";

const FOCUS = "tour-focus";

/**
 * Modo apresentação: conduz o pitch pelas telas do app, com dados 100% sintéticos (os mesmos da vitrine /celular),
 * e um painel que diz o que falar em cada passo. Não usa login, banco nem API: funciona offline.
 */
export function PitchTour({ onExit, start = 0 }: { onExit: () => void; start?: number }) {
  const steps = useMemo(() => buildSteps(demo as HealthData), []);
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initialTour>, a: TourAction) => tourReducer(steps.length, s, a),
    start,
    (s: number) => initialTour(Math.min(s, steps.length - 1)),
  );
  const [corner, setCorner] = useState<Corner>("direita");
  const pinned = useRef(false); // depois que a pessoa move o painel, ele deixa de escolher o canto sozinho
  const step = steps[state.index]!;

  // teclado do apresentador
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const action = keyToAction(e.key, e.target as HTMLElement | null);
      if (!action) return;
      e.preventDefault();
      if (action === "exit") onExit();
      else dispatch(action);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onExit]);

  // destaque do que está sendo explicado (a tela é remontada a cada passo, então espera o elemento aparecer)
  useEffect(() => {
    if (!step.target) {
      window.scrollTo?.({ top: 0 });
      return;
    }
    let el: Element | null = null;
    let timer = 0;
    let settle = 0;
    let tries = 0;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth < 1024; // no celular o painel fica embaixo: o destaque vai para o alto
    const find = () => {
      const found = [...document.querySelectorAll(step.target!)].find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (found) {
        el = found;
        found.classList.add(FOCUS);
        found.scrollIntoView?.({ block: mobile ? "start" : "center", behavior: reduce ? "auto" : "smooth" });
        // depois da rolagem, no computador, o painel vai para o canto que menos cobre o destaque
        settle = window.setTimeout(() => {
          const panel = document.querySelector(".tour");
          if (pinned.current || !el || !panel) return;
          const t = el.getBoundingClientRect();
          const p = panel.getBoundingClientRect();
          setCorner((c) => pickCorner(t, { w: window.innerWidth, h: window.innerHeight }, { w: p.width, h: p.height }, c));
        }, reduce ? 50 : 700);
      } else if (tries++ < 40) timer = window.setTimeout(find, 50);
    };
    find();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(settle);
      el?.classList.remove(FOCUS);
    };
  }, [step]);

  return (
    <>
      <ScreenPreview key={step.id} screen={step.screen} />
      <TourPanel
        step={step}
        index={state.index}
        total={steps.length}
        collapsed={state.collapsed}
        corner={corner}
        onPrev={() => dispatch({ type: "prev" })}
        onNext={() => dispatch({ type: "next" })}
        onExit={onExit}
        onToggle={() => dispatch({ type: "toggle" })}
        onMove={() => {
          pinned.current = true;
          setCorner((c) => (c === "direita" ? "esquerda" : "direita"));
        }}
      />
    </>
  );
}
