import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { StyleGuide } from "./style-guide/StyleGuide";
import "./styles.css";
import "./foundation.css";

const Root = lazy(() => import("./Root"));
const styleGuide = window.location.pathname.replace(/\/$/, "") === "/guia-de-estilo";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {styleGuide ? <StyleGuide /> : <Suspense fallback={<p>Carregando…</p>}><Root /></Suspense>}
  </StrictMode>,
);
