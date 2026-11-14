import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { StyleGuide } from "./style-guide/StyleGuide";
import "./styles.css";
import "./foundation.css";
import "./visual-map.css";
import "./polish.css";

const Root = lazy(() => import("./Root"));
const Celular = lazy(() => import("./celular/Celular").then((m) => ({ default: m.Celular })));
const ScreenPreview = lazy(() => import("./celular/ScreenPreview").then((m) => ({ default: m.ScreenPreview })));
const PitchTour = lazy(() => import("./pitch/PitchTour").then((m) => ({ default: m.PitchTour })));
const path = window.location.pathname.replace(/\/$/, "");
const styleGuide = path === "/guia-de-estilo";
// /apresentar abre direto o modo apresentação; /apresentar?passo=4 começa no passo 4 (para ensaiar)
const pitch = path === "/apresentar";
const pitchStart = Math.max(0, Number(new URLSearchParams(window.location.search).get("passo")) - 1) || 0;
const screen = path === "/celular/tela" ? new URLSearchParams(window.location.search).get("t") ?? "inicio" : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {styleGuide ? <StyleGuide /> : (
      <Suspense fallback={<p>Carregando…</p>}>
        {screen ? <ScreenPreview screen={screen} /> : pitch ? <PitchTour start={pitchStart} onExit={() => window.location.assign("/")} /> : path === "/celular" ? <Celular /> : <Root />}
      </Suspense>
    )}
  </StrictMode>,
);
