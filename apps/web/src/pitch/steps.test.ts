import { describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import type { HealthData } from "../types";
import { buildSteps, initialTour, keyToAction, totalSeconds, tourReducer } from "./steps";

const data = demo as HealthData;
const steps = buildSteps(data);

describe("buildSteps (os passos do pitch)", () => {
  it("tem passos completos, ids unicos e telas que o tour sabe mostrar", () => {
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    const telas = ["inicio", "exames", "linha", "alertas", "enviar", "acessos", "medico", "resumo"];
    for (const s of steps) {
      expect(s.title.length, s.id).toBeGreaterThan(5);
      expect(s.fala.length, s.id).toBeGreaterThan(30);
      expect(s.etapa.length, s.id).toBeGreaterThan(3);
      expect(telas, s.id).toContain(s.screen);
      expect(s.segundos, s.id).toBeGreaterThan(0);
    }
  });

  it("segue o caminho da paciente: envia, ve tudo junto, relogio, libera o medico, medico ve", () => {
    const ids = steps.map((s) => s.id);
    const pos = (id: string) => ids.indexOf(id);
    expect(pos("enviar")).toBeGreaterThan(-1);
    expect(pos("privacidade")).toBeGreaterThan(pos("alertas"));
    expect(pos("resumo")).toBeGreaterThan(pos("privacidade"));
    expect(ids[ids.length - 1]).toBe("fechamento");
  });

  it("os numeros vem dos dados (nada digitado a mao)", () => {
    const abertura = steps[0]!;
    expect(abertura.fala).toContain(`${data.points.length} resultados`);
    expect(abertura.fala).toContain(`${data.wearables.length} amostras`);
    const labs = new Set(data.points.map((p) => p.lab_name)).size;
    expect(abertura.fala).toContain(`${labs} laborat`);
    const outro = buildSteps({ ...data, points: data.points.slice(0, 1), wearables: [] });
    expect(outro[0]!.fala).toContain("1 resultado ");
    expect(outro[0]!.fala).toContain("0 amostras");
  });

  it("nao diagnostica nem cita doencas (regra do produto vale tambem para o texto do pitch)", () => {
    const proibidas = /diabetes|hipertens|arritmia|apneia|fibrila|c[âa]ncer|infarto|voc[êe] tem |voc[êe] est[áa] doente/i;
    for (const s of steps) {
      expect(`${s.title} ${s.fala} ${s.gargalo ?? ""}`, s.id).not.toMatch(proibidas);
    }
  });

  it("e honesto sobre os limites no fechamento", () => {
    const f = steps.find((s) => s.id === "fechamento")!;
    expect(f.fala).toMatch(/ainda sem teste real/);
    expect(f.fala).toMatch(/revisão clínica/);
  });

  it("o tempo sugerido cabe numa parte de software de um pitch de 10 min (5 a 8 min)", () => {
    expect(totalSeconds(steps)).toBeGreaterThanOrEqual(300);
    expect(totalSeconds(steps)).toBeLessThanOrEqual(480);
  });

  it("nao quebra com dados vazios", () => {
    const vazio = buildSteps({ ...data, points: [], wearables: [], alerts: [], events: [] });
    expect(vazio).toHaveLength(steps.length);
    expect(vazio[0]!.fala).toContain("0 resultados");
  });
});

describe("tourReducer", () => {
  const total = 5;
  const run = (s = initialTour(), ...acoes: Parameters<typeof tourReducer>[2][]) => acoes.reduce((st, a) => tourReducer(total, st, a), s);

  it("avanca e volta sem passar das pontas", () => {
    expect(run(initialTour(), { type: "prev" }).index).toBe(0);
    expect(run(initialTour(), { type: "next" }, { type: "next" }).index).toBe(2);
    expect(run(initialTour(4), { type: "next" }).index).toBe(4);
  });
  it("vai ao primeiro e ao ultimo", () => {
    expect(run(initialTour(2), { type: "last" }).index).toBe(4);
    expect(run(initialTour(3), { type: "first" }).index).toBe(0);
  });
  it("recolher e expandir nao muda o passo", () => {
    const s = run(initialTour(2), { type: "toggle" });
    expect(s).toEqual({ index: 2, collapsed: true });
    expect(run(s, { type: "toggle" }).collapsed).toBe(false);
  });
  it("aguenta total 0 ou 1", () => {
    expect(tourReducer(0, initialTour(), { type: "next" }).index).toBe(0);
    expect(tourReducer(1, initialTour(), { type: "next" }).index).toBe(0);
  });
  it("o passo inicial nunca e negativo", () => {
    expect(initialTour(-3).index).toBe(0);
  });
});

describe("keyToAction (teclado do apresentador)", () => {
  it("setas, espaco, paginas, Home, End e Esc", () => {
    expect(keyToAction("ArrowRight")).toEqual({ type: "next" });
    expect(keyToAction(" ")).toEqual({ type: "next" });
    expect(keyToAction("PageDown")).toEqual({ type: "next" });
    expect(keyToAction("ArrowLeft")).toEqual({ type: "prev" });
    expect(keyToAction("PageUp")).toEqual({ type: "prev" });
    expect(keyToAction("Home")).toEqual({ type: "first" });
    expect(keyToAction("End")).toEqual({ type: "last" });
    expect(keyToAction("Escape")).toBe("exit");
    expect(keyToAction("a")).toBeNull();
  });
  it("nao rouba teclas de campos de texto", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) expect(keyToAction("ArrowRight", { tagName })).toBeNull();
    expect(keyToAction("ArrowRight", { tagName: "DIV", isContentEditable: true })).toBeNull();
  });
  it("espaco em botao nao avanca o passo duas vezes, mas a seta funciona", () => {
    expect(keyToAction(" ", { tagName: "BUTTON" })).toBeNull();
    expect(keyToAction(" ", { tagName: "A" })).toBeNull();
    expect(keyToAction("ArrowRight", { tagName: "BUTTON" })).toEqual({ type: "next" });
  });
});
