"""Visao computacional e pos-processamento de OCR, sem rodar o OCR de verdade (rapido)."""
from pathlib import Path

import cv2
import numpy as np
import pytest

from app.services.extraction import ocr, preprocess, text_layer
from app.services.normalization.ontology import load_ontology

DATA = Path(__file__).resolve().parents[3] / "data"


@pytest.fixture(scope="module")
def onto():
    return load_ontology(DATA / "ontology")


def W(text, x0, x1, y0=10.0, y1=30.0, score=0.99):
    return ocr.OcrWord(text, score, x0, y0, x1, y1)


# ---------------------------------------------------------------- ontologia: nome e unidade com ruido de OCR
def test_fuzzy_name_fixes_ocr_confusion(onto):
    bm, ratio = onto.resolve_fuzzy("Hemoglobina glicada (HbAtc)")
    assert bm.canonical_name == "Hemoglobina glicada (HbA1c)" and ratio > 0.9


def test_fuzzy_name_refuses_ambiguity_and_short_or_unknown_names(onto):
    # 'LOL' esta a 1 letra de LDL e a 2 de HDL: perto demais para decidir sozinho
    assert onto.resolve_fuzzy("Colesterol LOL") is None, "LDL x HDL sem margem: vai para revisao"
    assert onto.resolve_fuzzy("TSH") is None and onto.resolve_fuzzy("ALT") is None
    assert onto.resolve_fuzzy("Protocolo de atendimento 123") is None


@pytest.mark.parametrize(
    "raw,expected,repaired",
    [
        ("μUl/mL", "µUI/mL", True),  # mu grego + 'l' no lugar de 'I' (erro real do OCR)
        ("mg/dL", "mg/dL", False),
        ("mg/dl", "mg/dl", False),  # so muda a caixa: ja e conhecida
        ("furlongs", "furlongs", False),  # desconhecida: nao inventa
        (None, None, False),
    ],
)
def test_repair_unit(onto, raw, expected, repaired):
    assert onto.repair_unit(raw) == (expected, repaired)


# ---------------------------------------------------------------- linha de resultado
def test_parse_value_glued_to_unit_and_unspaced_range(onto):
    p = text_layer.parse_result_line("Hemoglobina glicada (HbA1c) 5,9% 4,0-5,6", onto)
    o = p.observation
    assert (o.value, o.unit, o.ref_low, o.ref_high) == (5.9, "%", 4.0, 5.6)
    assert o.canonical_name == "Hemoglobina glicada (HbA1c)"


def test_parse_does_not_take_number_inside_name(onto):
    o = text_layer.parse_result_line("Vitamina D (25-OH) 24 ng/mL 30-100", onto).observation
    assert (o.raw_name, o.value, o.unit) == ("Vitamina D (25-OH)", 24.0, "ng/mL")


def test_parse_fuzzy_only_when_asked_and_records_the_correction(onto):
    line = "Hemoglobina glicada (HbAtc) 5,9 % 4,0 - 5,6"
    assert text_layer.parse_result_line(line, onto) is None
    o = text_layer.parse_result_line(line, onto, fuzzy=True).observation
    assert o.canonical_name == "Hemoglobina glicada (HbA1c)"
    assert o.notes and "similaridade" in o.notes[0]
    assert 0.85 < o.confidence < 1.0, "a similaridade limita a confianca"
    assert text_layer.parse_result_line("Colesterol LOL 138 mg/dL < 130", onto, fuzzy=True) is None


# ---------------------------------------------------------------- linhas e caixas do OCR
def test_group_lines_rebuilds_rows_from_column_order():
    # o OCR devolve a tabela em blocos por coluna, fora da ordem de leitura
    words = [
        W("106", 200, 230, 40, 60), W("5,9", 200, 230, 80, 100),
        W("Glicose", 10, 80, 40, 60), W("HbA1c", 10, 80, 80, 100),
        W("mg/dL", 240, 290, 40, 60), W("%", 240, 255, 80, 100),
    ]  # fmt: skip
    lines = ocr.group_lines(words)
    assert [ln.text for ln in lines] == ["Glicose 106 mg/dL", "HbA1c 5,9 %"]


def test_bbox_for_span_normalizes_and_interpolates_inside_glued_word():
    line = ocr.group_lines([W("5,9%", 100, 140, 20, 40)])[0]
    x0, y0, x1, y1 = line.bbox_for_span(0, 3, img_w=200, img_h=100)  # '5,9' de '5,9%'
    assert (x0, y0, y1) == pytest.approx((0.5, 0.2, 0.4))
    assert x1 == pytest.approx((100 + 40 * 3 / 4) / 200)
    assert line.bbox_for_span(50, 60, 200, 100) is None


def test_merge_split_numbers_only_joins_decimal_fragments():
    row = [W("0", 100, 108), W(",88", 110, 140), W("mg/dL", 150, 200)]
    out = ocr.merge_split_numbers(row)
    assert [w.text for w in out] == ["0,88", "mg/dL"]
    assert (out[0].x0, out[0].x1) == (100, 140), "a caixa cobre as duas partes"
    far = [W("12", 100, 120), W(",6", 400, 420)]
    assert [w.text for w in ocr.merge_split_numbers(far)] == ["12", ",6"], "longe demais: nao e o mesmo numero"


def test_drop_overlapping_removes_ghost_inside_a_longer_word():
    words = [W("162", 100, 130), W("2", 120, 128), W("mg/dL", 140, 190)]
    assert [w.text for w in ocr.drop_overlapping(words)] == ["162", "mg/dL"]


# ---------------------------------------------------------------- pre-processamento (OpenCV)
def _page_with_text(h=800, w=560, lines=14):
    img = np.full((h, w, 3), 255, np.uint8)
    for i in range(lines):
        cv2.putText(img, f"Exame numero {i} resultado {100 + i} mg/dL", (30, 60 + i * 48),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)  # fmt: skip
    return img


def test_finds_paper_on_dark_table_and_flattens_perspective():
    canvas = np.full((900, 1000, 3), 60, np.uint8)
    paper = _page_with_text()
    m = cv2.getRotationMatrix2D((280, 400), 6, 1.0)
    rotated = cv2.warpAffine(paper, m, (560, 800), borderValue=(0, 0, 0))
    mask = cv2.warpAffine(np.full((800, 560), 255, np.uint8), m, (560, 800))
    roi = canvas[50:850, 200:760]
    roi[mask > 0] = rotated[mask > 0]
    prep = preprocess.prepare_page(canvas)
    assert prep.page_found
    h, w = prep.image.shape[:2]
    assert w / h == pytest.approx(560 / 800, abs=0.06), "a pagina volta com a proporcao do papel"


def test_clean_page_is_left_alone():
    prep = preprocess.prepare_page(_page_with_text())
    assert not prep.page_found and not prep.flattened and prep.skew_deg == 0.0


def test_skew_without_paper_edges_is_corrected():
    page = _page_with_text()
    m = cv2.getRotationMatrix2D((280, 400), 4.0, 1.0)
    tilted = cv2.warpAffine(page, m, (560, 800), borderValue=(255, 255, 255))
    before = preprocess.estimate_skew(tilted)
    assert abs(before) > 1.0
    prep = preprocess.prepare_page(tilted)
    assert abs(preprocess.estimate_skew(prep.image)) < 1.0 <= abs(before)


def test_illumination_flattening_only_when_background_varies():
    clean = _page_with_text()
    shaded = (clean * np.linspace(0.55, 1.0, clean.shape[1])[None, :, None]).astype(np.uint8)
    assert preprocess.illumination_variation(clean) < preprocess.ILLUMINATION_THRESHOLD
    assert preprocess.illumination_variation(shaded) > preprocess.ILLUMINATION_THRESHOLD
    assert preprocess.prepare_page(shaded).flattened and not preprocess.prepare_page(clean).flattened


def test_remove_table_lines_keeps_digits_that_touch_the_border():
    img = np.full((500, 700, 3), 255, np.uint8)
    for x in (50, 300, 650):
        cv2.line(img, (x, 20), (x, 480), (30, 30, 30), 2)
    for y in (20, 120, 480):
        cv2.line(img, (50, y), (650, y), (30, 30, 30), 2)
    cv2.putText(img, "106", (240, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)  # encosta na linha x=300

    def dark(a):
        return int((a < 128).sum())

    out = preprocess.remove_table_lines(img)
    assert dark(out[200:450, 45:55]) < 0.1 * dark(img[200:450, 45:55]), "linha vertical longe do texto some"
    assert dark(out[130:140, 100:600]) < 0.1 * dark(img[130:140, 100:600]), "linha horizontal some"
    assert dark(out[40:100, 235:298]) > 0.7 * dark(img[40:100, 235:298]), "os digitos ficam"
    assert out.shape == img.shape
