import type { Section } from "./components/BottomNav";

export type ExamTab = "resultados" | "linha";
export interface Route {
  view: Section;
  tab: ExamTab;
}

/** Uma URL por aba da demonstracao (paciente Marta, dados sinteticos, SEM login nem cadastro). */
const PATHS: Record<string, Route> = {
  "/inicio": { view: "inicio", tab: "resultados" },
  "/exames": { view: "exames", tab: "resultados" },
  "/exames/linha-do-tempo": { view: "exames", tab: "linha" },
  "/enviar": { view: "enviar", tab: "resultados" },
  "/alertas": { view: "alertas", tab: "resultados" },
  "/privacidade": { view: "acessos", tab: "resultados" },
  "/acessos": { view: "acessos", tab: "resultados" }, // apelido
};

const norm = (p: string) => p.replace(/\/+$/, "") || "/";

/** A rota da demonstracao para um caminho, ou null se o caminho nao e de aba. */
export function routeFromPath(pathname: string): Route | null {
  return PATHS[norm(pathname)] ?? null;
}

export function pathFor(view: Section, tab: ExamTab = "resultados"): string {
  if (view === "exames") return tab === "linha" ? "/exames/linha-do-tempo" : "/exames";
  if (view === "acessos") return "/privacidade";
  return `/${view}`;
}
