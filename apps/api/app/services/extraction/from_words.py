"""Palavras com posicao (do OCR ou do texto do PDF) -> leituras de exame com caixa de origem.

E o miolo comum aos dois caminhos locais: agrupa em linhas, reconhece a linha de
resultado, corrige ruido de OCR (so quando `fuzzy`/`repair_units`) e calcula a
caixa do VALOR normalizada pelo tamanho da imagem da pagina.
"""
from typing import Literal

from app.services.normalization.ontology import Ontology

from . import ocr, text_layer
from .schemas import ExtractedObservation

BBOX_PAD = 0.1  # margem da caixa de origem, em fracao da altura do texto (medido: cobre o valor inteiro)


def observations_from_words(
    words: list[ocr.OcrWord],
    img_w: float,
    img_h: float,
    ontology: Ontology,
    *,
    page: int,
    method: Literal["text_layer", "ocr"],
    noisy: bool,
) -> tuple[list[ExtractedObservation], list[ocr.OcrLine]]:
    """`noisy=True` (OCR) liga a correcao de nome por similaridade e de unidade."""
    lines = ocr.group_lines(words)
    out: list[ExtractedObservation] = []
    for line in lines:
        parsed = text_layer.parse_result_line(line.text, ontology, page, fuzzy=noisy)
        if parsed is None:
            continue
        v0, v1 = parsed.value_span
        _, u1 = parsed.unit_span
        base = parsed.observation

        notes = list(base.notes)
        unit = base.unit
        if noisy:
            unit, repaired = ontology.repair_unit(base.unit)
            if repaired:
                notes.append(f"unidade '{base.unit}' corrigida para '{unit}'")

        # confianca = a pior entre o reconhecimento das palavras (valor+unidade) e a similaridade do nome
        scores = [s for s in (line.min_score(v0, u1), base.confidence) if s is not None]
        out.append(
            base.model_copy(
                update={
                    "unit": unit,
                    "notes": notes,
                    "bbox": line.bbox_for_span(v0, v1, img_w, img_h, pad=BBOX_PAD),
                    "confidence": min(scores) if scores else None,
                    "method": method,
                }
            )
        )
    return out, lines
