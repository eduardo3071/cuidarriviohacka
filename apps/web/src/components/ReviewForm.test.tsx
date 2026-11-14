import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Review, ReviewObservation } from "../data/documents";
import { toDraft } from "../lib/review";
import { ReviewForm } from "./ReviewForm";

const obs = (over: Partial<ReviewObservation> = {}): ReviewObservation => ({
  raw_name: "Glicose", canonical_name: "glucose", value: 95, unit: "mg/dL", ref_low: 70, ref_high: 99, ref_text: null,
  page: 1, bbox: [0.1, 0.2, 0.3, 0.25], confidence: 0.95, notes: [], method: "ocr", ...over,
});
const review = (o: ReviewObservation[], over: Partial<Review> = {}): Review => ({
  document_id: "d1", method: "ocr", lab_name: "Aurora", collected_at: "2026-03-10", warnings: [], observations: o,
  pages: [{ page: 1, url: "https://exemplo.test/p1.png" }], ...over,
});
const render = (r: Review, extra: Partial<Parameters<typeof ReviewForm>[0]> = {}) =>
  renderToStaticMarkup(
    <ReviewForm review={r} draft={toDraft(r)} onChange={() => {}} errors={[]} rowErrors={{}} busy={false} onConfirm={() => {}} onCancel={() => {}} {...extra} />,
  );

describe("ReviewForm", () => {
  it("mostra metodo, campos editaveis rotulados e o botao com a contagem", () => {
    const html = render(review([obs(), obs({ raw_name: "LDL" })]));
    expect(html).toContain("leitura da imagem (OCR)");
    expect(html).toContain('aria-label="Valor de Glicose"');
    expect(html).toContain('aria-label="Guardar LDL"');
    expect(html).toContain("Guardar 2 resultados no meu histórico");
    expect(html).toContain('value="Aurora"');
    expect(html).toContain('type="date"');
  });
  it("mostra a imagem da pagina com a caixa na posicao do valor lido", () => {
    const html = render(review([obs()]));
    expect(html).toContain('src="https://exemplo.test/p1.png"');
    expect(html).toContain("left:10%");
    expect(html).toContain("top:20%");
    expect(html).toContain("width:20%");
  });
  it("sem imagem disponivel, avisa para conferir no papel", () => {
    expect(render(review([obs()], { pages: [] }))).toContain("Confira os valores no papel");
  });
  it("sinaliza resultados que pedem conferencia extra", () => {
    const html = render(review([obs({ confidence: 0.4 }), obs({ notes: ["unidade corrigida"] }), obs()]));
    expect(html).toContain("2 resultados merecem");
    expect(html).toContain("conferir");
  });
  it("erros de validacao aparecem como alerta, por linha e no geral; botao some a contagem de zero", () => {
    const html = render(review([obs()]), { errors: ["Informe a data da coleta (dia/mês/ano)."], rowErrors: { 0: "O valor precisa ser um número." } });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Informe a data da coleta");
    expect(html).toContain("O valor precisa ser um número.");
  });
  it("ocupado desabilita o envio", () => {
    expect(render(review([obs()]), { busy: true })).toMatch(/<button[^>]*disabled[^>]*>(<span>)?Guardando…/);
  });
});
