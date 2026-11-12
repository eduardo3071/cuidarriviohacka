"""Roteador de extracao: escolhe texto -> OCR -> IA. Sem OCR/IA reais (motores falsos)."""
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from app.services.extraction import dates
from app.services.extraction.llm_extractor import LLMExtraction, LLMObservation
from app.services.extraction.router import Capabilities, ExtractionError, extract_document
from app.services.llm.base import LLMError, LLMResult
from app.services.normalization.ontology import load_ontology

DATA = Path(__file__).resolve().parents[3] / "data"
EXAMS = DATA / "synthetic" / "marta" / "exams"
JPEG = b"\xff\xd8\xff"


@pytest.fixture(scope="module")
def onto():
    return load_ontology(DATA / "ontology")


def pdf(name):
    return (EXAMS / name).read_bytes()


def white_png() -> bytes:
    ok, buf = cv2.imencode(".png", np.full((1000, 800, 3), 255, np.uint8))
    assert ok
    return buf.tobytes()


class FakeLLM:
    model = "fake"

    def __init__(self, extraction=None, error=None):
        self.extraction, self.error, self.calls = extraction, error, []

    def parse(self, *, system, user_text, images=(), schema):
        self.calls.append({"user_text": user_text, "images": list(images)})
        if self.error:
            raise self.error
        return LLMResult(parsed=self.extraction, input_tokens=1, output_tokens=1, model="fake")


class FakeOcrEngine:
    """Imita o RapidOCR: devolve palavras com caixa. Cada linha de texto vira uma fileira."""

    def __init__(self, rows):
        self.rows = rows

    def __call__(self, img, return_word_box=True):
        segs = []
        for i, row in enumerate(self.rows):
            y, x, seg = 100 + i * 40, 50, []
            for w in row.split():
                width = 10 * len(w)
                seg.append((w, 0.99, [[x, y], [x + width, y], [x + width, y + 20], [x, y + 20]]))
                x += width + 10
            segs.append(tuple(seg))
        return SimpleNamespace(word_results=tuple(segs))


GLU = LLMObservation(raw_name="Glicemia de jejum", value=118, unit="mg/dL", ref_low=70, ref_high=110, ref_text="70 a 110")
EXTRACTION = LLMExtraction(lab_name="Diagnosticos Vita", collected_at=None, observations=[GLU])


# ---------------------------------------------------------------- caminho 1: texto do PDF
@pytest.mark.parametrize("name,date", [("aurora_2023.pdf", "2023-10-17"), ("lakeside_2019.pdf", "2019-08-21")])
def test_text_pdf_needs_no_ocr_or_llm_and_gives_bbox_and_date(onto, name, date):
    out = extract_document(pdf(name), "application/pdf", Capabilities(onto))
    assert out.method == "text_layer" and len(out.observations) == 11
    assert out.collected_at == date
    assert all(o.method == "text_layer" and o.bbox and all(0 <= c <= 1 for c in o.bbox) for o in out.observations)
    assert len(out.page_images) == 1 and out.page_images[0].startswith(JPEG)


# ---------------------------------------------------------------- caminho 3: IA (layout que a regra nao entende)
def test_unknown_layout_without_any_engine_is_a_clear_error(onto):
    with pytest.raises(ExtractionError) as ei:
        extract_document(pdf("vita_2026.pdf"), "application/pdf", Capabilities(onto))
    assert ei.value.code == "no_extractor"


def test_unknown_layout_falls_back_to_llm_with_text_not_images(onto):
    llm = FakeLLM(EXTRACTION)
    out = extract_document(pdf("vita_2026.pdf"), "application/pdf", Capabilities(onto, llm=llm))
    assert out.method == "llm" and out.lab_name == "Diagnosticos Vita"
    assert out.collected_at == "2026-09-28", "a data vem do texto do laudo quando a IA nao informa"
    assert llm.calls[0]["images"] == [] and "GLICEMIA DE JEJUM" in llm.calls[0]["user_text"]  # o laudo imprime em caixa alta
    o = out.observations[0]
    assert o.canonical_name == "Glicemia de jejum" and o.bbox is None, "a IA nao devolve posicao"
    assert out.page_images and out.page_images[0].startswith(JPEG)


def test_llm_failure_becomes_extraction_error(onto):
    with pytest.raises(ExtractionError) as ei:
        extract_document(
            pdf("vita_2026.pdf"), "application/pdf", Capabilities(onto, llm=FakeLLM(error=LLMError("sem credencial")))
        )
    assert ei.value.code == "llm_failed" and "sem credencial" in ei.value.message


def test_llm_with_no_results_is_no_results(onto):
    empty = LLMExtraction(lab_name=None, collected_at=None, observations=[])
    with pytest.raises(ExtractionError) as ei:
        extract_document(pdf("vita_2026.pdf"), "application/pdf", Capabilities(onto, llm=FakeLLM(empty)))
    assert ei.value.code == "no_results"


# ---------------------------------------------------------------- caminho 2: OCR (imagem)
def test_image_goes_through_ocr_and_boxes_follow_the_prepared_page(onto):
    engine = FakeOcrEngine(
        ["Data da coleta: 17/10/2023", "Glicose em jejum 106 mg/dL 70 - 99", "Colesterol LDL 138 mg/dL < 130"]
    )
    out = extract_document(white_png(), "image/png", Capabilities(onto, ocr_enabled=True, ocr_engine=engine))
    assert out.method == "ocr" and out.collected_at == "2023-10-17"
    assert [(o.canonical_name, o.value) for o in out.observations] == [("Glicemia de jejum", 106.0), ("Colesterol LDL", 138.0)]
    assert all(o.method == "ocr" and o.bbox and o.confidence == pytest.approx(0.99) for o in out.observations)
    assert out.page_images[0].startswith(JPEG)


def test_ocr_empty_falls_back_to_llm_images_and_keeps_the_warning_trail(onto):
    llm = FakeLLM(EXTRACTION)
    caps = Capabilities(onto, ocr_enabled=True, ocr_engine=FakeOcrEngine(["texto sem exame nenhum"]), llm=llm)
    out = extract_document(white_png(), "image/png", caps)
    assert out.method == "llm" and "OCR local nao reconheceu resultados." in out.warnings
    assert len(llm.calls[0]["images"]) == 1


def test_image_without_engines_and_ocr_disabled(onto):
    with pytest.raises(ExtractionError) as ei:
        extract_document(white_png(), "image/png", Capabilities(onto))
    assert ei.value.code == "no_extractor"


def test_ocr_finds_nothing_and_no_llm_is_no_results(onto):
    caps = Capabilities(onto, ocr_enabled=True, ocr_engine=FakeOcrEngine(["nada aqui"]))
    with pytest.raises(ExtractionError) as ei:
        extract_document(white_png(), "image/png", caps)
    assert ei.value.code == "no_results"


# ---------------------------------------------------------------- entradas invalidas
def test_corrupt_inputs_are_rejected_cleanly(onto):
    caps = Capabilities(onto)
    with pytest.raises(ExtractionError) as e1:
        extract_document(b"%PDF-1.4 isto nao e um pdf", "application/pdf", caps)
    assert e1.value.code == "invalid_pdf"
    with pytest.raises(ExtractionError) as e2:
        extract_document(b"nao e imagem", "image/jpeg", caps)
    assert e2.value.code == "invalid_image"


# ---------------------------------------------------------------- data da coleta
@pytest.mark.parametrize(
    "text,expected",
    [
        ("Data da coleta: 17/10/2023", "2023-10-17"),
        ("Collected: 2019-08-21", "2019-08-21"),
        ("Coleta: 28/09/2026", "2026-09-28"),
        ("Material: Soro  Data de coleta 03-02-2021", "2021-02-03"),
        ("Nascimento: 14/03/1968  Liberado em 20/10/2023", None),  # sem palavra-chave: nao chuta
        ("Data da coleta: 31/02/2023", None),  # data impossivel
    ],
)
def test_find_collection_date(text, expected):
    assert dates.find_collection_date(text) == expected
