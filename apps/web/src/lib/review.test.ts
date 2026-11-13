import { describe, expect, it } from "vitest";
import type { Review, ReviewObservation } from "../data/documents";
import { buildConfirm, needsAttention, parseNumber, toDraft } from "./review";

const obs = (over: Partial<ReviewObservation> = {}): ReviewObservation => ({
  raw_name: "Glicose", canonical_name: "glucose", value: 95, unit: "mg/dL", ref_low: 70, ref_high: 99, ref_text: "70 a 99",
  page: 1, bbox: [0.1, 0.1, 0.2, 0.2], confidence: 0.95, notes: [], method: "text_layer", ...over,
});
const review = (observations: ReviewObservation[], over: Partial<Review> = {}): Review => ({
  document_id: "d1", method: "text_layer", lab_name: "Aurora", collected_at: "2026-03-10", warnings: [], observations, pages: [], ...over,
});
const TODAY = new Date("2026-11-12T12:00:00Z");

describe("parseNumber", () => {
  it("aceita ponto e virgula decimal; recusa texto, vazio, milhar e infinito", () => {
    expect(parseNumber("5,4")).toBe(5.4);
    expect(parseNumber(" 5.4 ")).toBe(5.4);
    expect(parseNumber("-0,5")).toBe(-0.5);
    expect(parseNumber(".5")).toBe(0.5);
    for (const bad of ["", "abc", "1.234,5", "5,4,3", "Infinity", "NaN", "1e3", "--1"]) expect(parseNumber(bad), bad).toBeNull();
  });
});

describe("buildConfirm", () => {
  it("rascunho intacto vira payload identico a leitura (nada marcado como manual)", () => {
    const r = buildConfirm(toDraft(review([obs()])), TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.collected_at).toBe("2026-03-10");
    expect(r.payload.lab_name).toBe("Aurora");
    expect(r.payload.observations[0]).toMatchObject({ raw_name: "Glicose", canonical_name: "glucose", value: 95, method: "text_layer", ref_text: "70 a 99", bbox: [0.1, 0.1, 0.2, 0.2] });
  });
  it("editar valor marca como manual e limpa o ref_text impresso", () => {
    const d = toDraft(review([obs()]));
    d.rows[0]!.value = "101,5";
    const r = buildConfirm(d, TODAY);
    expect(r.ok && r.payload.observations[0]).toMatchObject({ value: 101.5, method: "manual", ref_text: null, canonical_name: "glucose" });
  });
  it("trocar o nome solta o biomarcador resolvido (o servidor resolve de novo)", () => {
    const d = toDraft(review([obs()]));
    d.rows[0]!.raw_name = "Glicemia de jejum";
    const r = buildConfirm(d, TODAY);
    expect(r.ok && r.payload.observations[0]).toMatchObject({ raw_name: "Glicemia de jejum", canonical_name: null });
  });
  it("linhas desmarcadas nao vao; sem nenhuma marcada recusa", () => {
    const d = toDraft(review([obs(), obs({ raw_name: "LDL", canonical_name: "ldl" })]));
    d.rows[0]!.include = false;
    const r = buildConfirm(d, TODAY);
    expect(r.ok && r.payload.observations.map((o) => o.raw_name)).toEqual(["LDL"]);
    d.rows[1]!.include = false;
    const none = buildConfirm(d, TODAY);
    expect(!none.ok && none.errors.join(" ")).toMatch(/pelo menos um/);
  });
  it("data: obrigatoria, valida, nem futura nem anterior a 1900", () => {
    const base = toDraft(review([obs()]));
    for (const [v, msg] of [["", /data da coleta/], ["31/02/2026", /data da coleta/], ["2026-02-31", /data da coleta/], ["2026-11-13", /futuro/], ["1899-12-31", /1900/]] as const) {
      const r = buildConfirm({ ...base, collectedAt: v }, TODAY);
      expect(!r.ok && r.errors.join(" "), v).toMatch(msg);
    }
    expect(buildConfirm({ ...base, collectedAt: "2026-11-12" }, TODAY).ok).toBe(true); // hoje vale
  });
  it("erros por linha: valor nao numerico, faixa invertida, nome vazio", () => {
    const d = toDraft(review([obs(), obs(), obs()]));
    d.rows[0]!.value = "abc";
    d.rows[1]!.ref_low = "120";
    d.rows[2]!.raw_name = "  ";
    const r = buildConfirm(d, TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rowErrors[0]).toMatch(/número/);
    expect(r.rowErrors[1]).toMatch(/maior/);
    expect(r.rowErrors[2]).toMatch(/nome/);
    expect(r.errors.join(" ")).toMatch(/Corrija/);
  });
  it("faixa e unidade em branco viram null (nao string vazia)", () => {
    const d = toDraft(review([obs({ unit: null, ref_low: null, ref_high: null, ref_text: null })]));
    const r = buildConfirm(d, TODAY);
    expect(r.ok && r.payload.observations[0]).toMatchObject({ unit: null, ref_low: null, ref_high: null });
  });
  it("laboratorio em branco vira null", () => {
    const r = buildConfirm({ ...toDraft(review([obs()])), labName: "   " }, TODAY);
    expect(r.ok && r.payload.lab_name).toBeNull();
  });
});

describe("needsAttention", () => {
  it("confianca baixa ou correcao automatica pedem olhar; confianca desconhecida sozinha nao", () => {
    expect(needsAttention(obs({ confidence: 0.5 }))).toBe(true);
    expect(needsAttention(obs({ notes: ["unidade corrigida"] }))).toBe(true);
    expect(needsAttention(obs({ confidence: null }))).toBe(false);
    expect(needsAttention(obs({ confidence: 0.99 }))).toBe(false);
  });
});
