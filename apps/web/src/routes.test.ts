import { describe, expect, it } from "vitest";
import { pathFor, routeFromPath } from "./routes";

describe("rotas da demonstracao", () => {
  it("cada aba tem a sua URL e volta ao mesmo lugar", () => {
    for (const [view, tab] of [["inicio", "resultados"], ["exames", "resultados"], ["exames", "linha"], ["enviar", "resultados"], ["alertas", "resultados"], ["acessos", "resultados"]] as const)
      expect(routeFromPath(pathFor(view, tab))).toEqual({ view, tab });
  });
  it("aceita barra final e o apelido /acessos; ignora o resto", () => {
    expect(routeFromPath("/exames/")).toEqual({ view: "exames", tab: "resultados" });
    expect(routeFromPath("/acessos")?.view).toBe("acessos");
    for (const p of ["/", "/celular", "/apresentar", "/guia-de-estilo", "/login", "/cadastro"]) expect(routeFromPath(p)).toBeNull();
  });
});
