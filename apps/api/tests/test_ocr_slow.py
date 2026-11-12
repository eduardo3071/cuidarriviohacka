"""OCR real de ponta a ponta nos exames sinteticos. LENTO (~10 s/pagina): `pytest -m slow`.

Os exames sao sinteticos (layout feito por nos): estes testes provam que o pipeline
funciona neles e que as caixas de origem apontam para o lugar certo; NAO provam
desempenho em laudos/fotos reais.
"""
import json
from pathlib import Path
from uuid import UUID

import cv2
import numpy as np
import pdfplumber
import pytest

from app.services.extraction import ocr_extractor, text_layer
from app.services.extraction.evaluate import score
from app.services.normalization.ontology import load_ontology

pytestmark = pytest.mark.slow

DATA = Path(__file__).resolve().parents[3] / "data"
EXAMS = DATA / "synthetic" / "marta" / "exams"
# Medido (margem 0.1): a caixa cobre 0.92-1.00 da palavra do PDF e tem 1.5-2.4x a area dela.
# IoU nao serve aqui: a margem de proposito torna a caixa maior que a palavra.
MIN_COVERAGE = 0.85
MAX_AREA_RATIO = 3.5


@pytest.fixture(scope="module")
def onto():
    return load_ontology(DATA / "ontology")


@pytest.fixture(scope="module")
def engine():
    from app.services.extraction import ocr

    return ocr.get_engine()


def _truth(name):
    return json.loads((EXAMS / f"{Path(name).stem}.truth.json").read_text(encoding="utf-8"))["observations"]


def _area(b):
    return (b[2] - b[0]) * (b[3] - b[1])


def _inter(a, b):
    return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))


@pytest.fixture(scope="module")
def pdf_scans(onto, engine):
    return {n: ocr_extractor.extract_pdf_as_scan(EXAMS / n, onto, engine=engine)[0] for n in ("aurora_2023.pdf", "lakeside_2019.pdf")}


@pytest.mark.parametrize("name", ["aurora_2023.pdf", "lakeside_2019.pdf"])
def test_pdf_as_scan_reads_everything_with_lab_ranges(onto, pdf_scans, name):
    sc = score(_truth(name), pdf_scans[name].observations, onto)
    assert sc.correct == sc.total == 11, (sc.missing, sc.wrong, sc.extra)
    assert sc.ref_correct == 11 and not sc.extra


@pytest.mark.parametrize("name", ["aurora_2023.pdf", "lakeside_2019.pdf"])
def test_source_bbox_lands_on_the_value(pdf_scans, name):
    """Gabarito de posicao: as palavras do PDF (pdfplumber). A pagina plana nao e cortada, entao x/W, y/H alinham."""
    with pdfplumber.open(EXAMS / name) as pdf:
        pg = pdf.pages[0]
        pdf_words = []
        for w in pg.extract_words():
            try:
                v = text_layer.to_float(w["text"])
            except ValueError:
                continue
            pdf_words.append((v, (w["x0"] / pg.width, w["top"] / pg.height, w["x1"] / pg.width, w["bottom"] / pg.height)))
    for o in pdf_scans[name].observations:
        assert o.bbox is not None and all(0 <= c <= 1 for c in o.bbox)
        same_value = [b for v, b in pdf_words if abs(v - o.value) < 1e-9]
        assert same_value, f"{o.raw_name}: o PDF nao tem a palavra {o.value}"
        word = max(same_value, key=lambda b: _inter(o.bbox, b))  # a palavra do PDF onde a caixa caiu
        coverage = _inter(o.bbox, word) / _area(word)
        assert coverage >= MIN_COVERAGE, f"{o.raw_name}: a caixa cobre so {coverage:.0%} do valor {o.value}"
        assert _area(o.bbox) / _area(word) <= MAX_AREA_RATIO, f"{o.raw_name}: caixa grande demais"


def test_api_end_to_end_with_real_ocr_on_the_photo(onto, engine):
    """Foto -> upload -> fila -> OCR real -> revisao (com caixas e pagina guardada) -> confirmacao."""
    from test_api_documents import Env

    from app.services.extraction.router import Capabilities

    e = Env(onto)
    e.svc.caps = Capabilities(onto, ocr_enabled=True, ocr_engine=engine)
    r = e.upload((EXAMS / "aurora_2023_foto.jpg").read_bytes(), name="foto.jpg", ctype="image/jpeg")
    assert r.status_code == 202
    doc = r.json()["document_id"]
    review = e.get(f"/documents/{doc}/review").json()
    assert review["method"] == "ocr" and len(review["observations"]) == 11
    assert review["collected_at"] == "2023-10-17"
    assert all(o["bbox"] and o["method"] == "ocr" and o["confidence"] is not None for o in review["observations"])

    page = e.storage.objects[e.repo.documents[UUID(doc)].page_paths[0]][0]  # a pagina plana: referencia das bbox
    assert page[:3] == b"\xff\xd8\xff" and cv2.imdecode(np.frombuffer(page, np.uint8), cv2.IMREAD_COLOR) is not None

    body = {"collected_at": review["collected_at"], "lab_name": "Laboratorio Aurora", "observations": review["observations"]}
    assert e.confirm(doc, body).json() == {"confirmed": 11, "submitted": 11, "already": False}
    assert {o["canonical_name"] for o in e.repo.observations} >= {"Glicemia de jejum", "Hemoglobina glicada (HbA1c)"}


def test_simulated_photo_is_straightened_and_read(onto, engine):
    out = ocr_extractor.extract_page((EXAMS / "aurora_2023_foto.jpg").read_bytes(), onto, engine=engine)
    assert out.page_found and out.flattened, "achou o papel e removeu a sombra"
    sc = score(_truth("aurora_2023_foto.jpg"), out.observations, onto)
    assert sc.correct == sc.total == 11, (sc.missing, sc.wrong, sc.extra)
    assert sc.ref_correct == 11
    assert all(o.bbox and o.confidence is not None for o in out.observations)
