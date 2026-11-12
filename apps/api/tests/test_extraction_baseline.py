"""Extrator base (sem IA) + medidor de acerto, sobre os exames sinteticos de teste."""
import json
from pathlib import Path

import pytest

from app.services.extraction import text_layer
from app.services.extraction.evaluate import score
from app.services.normalization.ontology import load_ontology

DATA = Path(__file__).resolve().parents[3] / "data"
EXAMS = DATA / "synthetic" / "marta" / "exams"


@pytest.fixture(scope="module")
def onto():
    return load_ontology(DATA / "ontology")


@pytest.mark.parametrize(
    "text,expected",
    [
        ("70 - 99", (70.0, 99.0)),
        ("0,50 - 1,00", (0.5, 1.0)),
        ("< 130", (None, 130.0)),
        ("> 50", (50.0, None)),
        ("H (3.9 - 5.5)", (3.9, 5.5)),
        ("Valor de referencia: 70 a 110", (70.0, 110.0)),
        ("", (None, None)),
    ],
)
def test_parse_ref(text, expected):
    lo, hi, _ = text_layer.parse_ref(text)
    assert (lo, hi) == expected


def _truth(name):
    return json.loads((EXAMS / f"{name}.truth.json").read_text(encoding="utf-8"))["observations"]


@pytest.mark.parametrize("name", ["aurora_2023", "lakeside_2019"])
def test_baseline_reads_single_line_layouts_fully(onto, name):
    sc = score(_truth(name), text_layer.extract_observations(EXAMS / f"{name}.pdf", onto), onto)
    assert sc.correct == sc.total == 11
    assert sc.ref_correct == 11, "a faixa do laudo (nao a generica) deve vir junto"
    assert not sc.extra, "linhas de cabecalho/rodape nao podem virar resultado"


def test_score_flags_wrong_value_and_missing(onto):
    truth = _truth("aurora_2023")
    got = text_layer.extract_observations(EXAMS / "aurora_2023.pdf", onto)
    got[0] = got[0].model_copy(update={"value": got[0].value + 1})
    got.pop(1)
    sc = score(truth, got, onto)
    assert sc.correct == 9 and len(sc.wrong) == 1 and len(sc.missing) == 1
