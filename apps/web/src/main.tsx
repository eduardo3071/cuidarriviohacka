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
const path = window.location.pathname.replace(/\/$/, "");
const styleGuide = path === "/guia-de-estilo";
const screen = path === "/celular/tela" ? new URLSearchParams(window.location.search).get("t") ?? "inicio" : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {styleGuide ? <StyleGuide /> : (
      <Suspense fallback={<p>Carregando…</p>}>
        {screen ? <ScreenPreview screen={screen} /> : path === "/celular" ? <Celular /> : <Root />}
      </Suspense>
    )}
  </StrictMode>,
);
