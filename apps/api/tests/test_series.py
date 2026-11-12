"""Series comparaveis entre laboratorios: conversao exata, faixa do proprio laudo, casos de borda."""
import csv
from collections import Counter
from decimal import Decimal as D
from pathlib import Path

import pytest

from app.services.normalization.ontology import load_ontology
from app.services.normalization.series import build_point, build_points, flag_for, group_by_biomarker

DATA = Path(__file__).resolve().parents[3] / "data"


@pytest.fixture(scope="module")
def onto():
    return load_ontology(DATA / "ontology")


@pytest.fixture(scope="module")
def points(onto):
    with open(DATA / "synthetic" / "marta" / "observations.csv", encoding="utf-8", newline="") as f:
        rows = [{**r, "collected_at": r["collected_at"], "ref_low": r["ref_low"] or None, "ref_high": r["ref_high"] or None, "unit": r["unit"], "value": r["value"]} for r in csv.DictReader(f)]
    return build_points(rows, onto)


def row(**kw):
    base = {"raw_name": "Glicose em jejum", "value": "101", "unit": "mg/dL", "ref_low": "70", "ref_high": "99", "ref_text": "70 - 99", "collected_at": "2021-09-02", "lab_name": "X"}
    base.update(kw)
    return base


# ---------------------------------------------------------------- a regra central
def test_same_value_can_be_in_range_for_one_lab_and_above_for_another(onto):
    aurora = build_point(row(ref_high="99"), onto)
    vita = build_point(row(ref_high="110"), onto)
    assert (aurora.value, vita.value) == (D("101"), D("101")), "mesmo valor normalizado"
    assert (aurora.flag, vita.flag) == ("above", "in_range"), "bandeira pela faixa do PROPRIO laudo"


@pytest.mark.parametrize(
    "value,low,high,expected",
    [
        (D("130"), None, D("130"), "in_range"),  # '< 130' com 130: o limite exato conta como dentro
        (D("131"), None, D("130"), "above"),
        (D("49.9"), D("50"), None, "below"),
        (D("50"), D("50"), None, "in_range"),
        (D("5"), None, None, "no_range"),
        (D("0"), D("1"), D("2"), "below"),
    ],
)
def test_flag_for(value, low, high, expected):
    assert flag_for(value, low, high) == expected


# ---------------------------------------------------------------- conversao exata
def test_conversion_is_exact_decimal_not_float(onto):
    glu = build_point(row(raw_name="Fasting Glucose", value="5.5", unit="mmol/L", ref_low="3.9", ref_high="5.5"), onto)
    assert (glu.value, glu.ref_low, glu.ref_high) == (D("99.088"), D("70.262"), D("99.088"))
    assert glu.normalization == "converted" and glu.unit_canonical == "mg/dL"
    assert (glu.raw_value, glu.raw_unit, glu.raw_ref_high) == (D("5.5"), "mmol/L", D("5.5")), "o original fica intacto"


def test_conversion_with_offset_hba1c(onto):
    p = build_point(row(raw_name="Hemoglobin A1c", value="39", unit="mmol/mol", ref_low="20", ref_high="42"), onto)
    assert p.value == D("5.719")  # 39*0.0915+2.15 = 5.7185 -> HALF_UP (float daria 5.718)
    assert (p.ref_low, p.ref_high) == (D("3.980"), D("5.993"))


def test_canonical_unit_and_case_and_mu_variants(onto):
    assert build_point(row(unit="mg/dl"), onto).normalization == "canonical"
    tsh = build_point(row(raw_name="TSH", value="2.1", unit="µUI/mL", ref_low="0.4", ref_high="4"), onto)
    tsh_greek = build_point(row(raw_name="TSH", value="2.1", unit="μUI/mL", ref_low="0.4", ref_high="4"), onto)
    assert tsh.normalization == tsh_greek.normalization == "converted" and tsh.value == tsh_greek.value == D("2.100")


# ---------------------------------------------------------------- casos que nao podem ser inventados
def test_unknown_unit_is_not_guessed(onto):
    p = build_point(row(unit="furlongs"), onto)
    assert p.normalization == "unit_unknown" and p.value is None and p.ref_high is None
    assert p.flag == "above", "a bandeira continua valendo nos valores originais"
    assert build_point(row(unit=None), onto).normalization == "unit_unknown"


def test_unrecognized_test_name_is_unmapped(onto):
    p = build_point(row(raw_name="Exame Que Nao Existe"), onto)
    assert p.biomarker is None and p.normalization == "unmapped" and p.value is None


def test_confirmed_canonical_name_wins_over_raw_name(onto):
    p = build_point(row(raw_name="nome ilegivel", canonical_name="Glicemia de jejum"), onto)
    assert p.biomarker == "Glicemia de jejum" and p.value == D("101")


# ---------------------------------------------------------------- o dado do seed (a narrativa da demo)
def test_every_seed_reading_is_normalized(points):
    assert len(points) == 75
    # convertidas = Lakeside sem TSH e ALT (ja canonicos) = 9, mais TSH em µUI/mL (Aurora x3) e mUI/L (Vita x3) = 6
    assert Counter(p.normalization for p in points) == {"canonical": 60, "converted": 15}


def test_glucose_is_one_series_across_three_labs_with_each_point_on_its_own_range(points):
    s = group_by_biomarker(points)["Glicemia de jejum"]
    assert [p.value for p in s] == [D(v) for v in ("91", "95", "99.088", "101", "106", "111", "118")]
    assert [p.lab_name for p in s] == ["Laboratorio Aurora", "Laboratorio Aurora", "Lakeside Medical Centre", "Diagnosticos Vita", "Laboratorio Aurora", "Diagnosticos Vita", "Diagnosticos Vita"]
    # faixas canonicas por laudo (a banda que o grafico desenha em cada ponto)
    assert [(p.ref_low, p.ref_high) for p in s] == [
        (D("70"), D("99")), (D("70"), D("99")), (D("70.262"), D("99.088")), (D("70"), D("110")),
        (D("70"), D("99")), (D("70"), D("110")), (D("70"), D("110")),
    ]  # fmt: skip
    assert [p.flag for p in s] == ["in_range", "in_range", "in_range", "in_range", "above", "above", "above"]


def test_series_are_chronological_and_only_normalizable_points(points, onto):
    groups = group_by_biomarker(points)
    assert len(groups) == 11 and sum(len(v) for v in groups.values()) == 75
    for name, s in groups.items():
        assert [p.collected_at for p in s] == sorted(p.collected_at for p in s), name
        assert {p.unit_canonical for p in s} == {onto.biomarkers[name].unit_canonical}


def test_unmapped_and_unit_unknown_points_stay_out_of_the_chart(onto):
    pts = build_points([row(), row(unit="furlongs"), row(raw_name="Inventado")], onto)
    assert [len(v) for v in group_by_biomarker(pts).values()] == [1]
