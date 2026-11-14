import { describe, expect, it } from "vitest";
import { pickCorner } from "./placement";

const view = { w: 1280, h: 800 };
const panel = { w: 400, h: 320 };
const box = (left: number, top: number, w: number, h: number) => ({ left, top, right: left + w, bottom: top + h });

describe("pickCorner", () => {
  it("alvo no canto direito de baixo: o painel vai para a esquerda", () => {
    expect(pickCorner(box(880, 500, 340, 250), view, panel, "direita")).toBe("esquerda");
  });
  it("alvo no canto esquerdo de baixo: o painel vai para a direita", () => {
    expect(pickCorner(box(290, 500, 340, 250), view, panel, "esquerda")).toBe("direita");
  });
  it("alvo no alto da tela nao incomoda: mantem o canto atual (nao pula de lado)", () => {
    expect(pickCorner(box(300, 100, 900, 200), view, panel, "direita")).toBe("direita");
    expect(pickCorner(box(300, 100, 900, 200), view, panel, "esquerda")).toBe("esquerda");
  });
  it("no celular nada muda (o painel e uma folha de baixo)", () => {
    expect(pickCorner(box(0, 500, 375, 250), { w: 375, h: 812 }, { w: 351, h: 300 }, "direita")).toBe("direita");
  });
  it("alvo largo cobrindo os dois cantos: fica com o que cobre menos", () => {
    // cobre bem mais o lado direito do que o esquerdo
    expect(pickCorner(box(700, 480, 560, 300), view, panel, "direita")).toBe("esquerda");
  });
  it("usa o tamanho real do painel (painel recolhido e baixinho nao cobre o alvo)", () => {
    expect(pickCorner(box(880, 700, 340, 80), view, { w: 400, h: 40 }, "direita")).toBe("esquerda");
  });
});
