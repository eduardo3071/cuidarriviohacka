"""Consistencia dos dados do seed (sem banco): ontologia + paciente sintetica Marta."""
import csv
from pathlib import Path

import pytest

from app.services.normalization.convert import to_canonical
from app.services.normalization.ontology import load_ontology
from app.services.normalization.text import normalize_alias

DATA = Path(__file__).resolve().parents[3] / "data"


@pytest.fixture(scope="module")
def ontology():
    return load_ontology(DATA / "ontology")


@pytest.fixture(scope="module")
def observations():
    with open(DATA / "synthetic" / "marta" / "observations.csv", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_normalize_alias():
    assert normalize_alias("Hemoglobina glicada (HbA1c)") == "hemoglobina glicada hba1c"
    assert normalize_alias("Triglicérides") == "triglicerides"
    assert normalize_alias("Triglycerides") == "triglycerides"  # grafia em ingles: alias a parte
    assert normalize_alias("  LDL-C ") == "ldl c"
    assert normalize_alias("25-Hidroxivitamina D") == "25 hidroxivitamina d"


def test_ontology_loads_without_alias_collisions(ontology):
    assert len(ontology.biomarkers) >= 20


def test_every_observation_name_resolves(ontology, observations):
    unresolved = {o["raw_name"] for o in observations if ontology.resolve(o["raw_name"]) is None}
    assert not unresolved, f"nomes sem alias: {unresolved}"


def test_every_observation_unit_is_canonical_or_convertible(ontology, observations):
    bad = []
    for o in observations:
        bm = ontology.resolve(o["raw_name"])
        val = to_canonical(
            float(o["value"]), o["unit"], bm.unit_canonical, ontology.conversions.get(bm.canonical_name, {})
        )
        if val is None:
            bad.append((o["raw_name"], o["unit"]))
    assert not bad, f"unidades sem conversao: {bad}"


def test_three_labs_normalize_to_one_series(ontology, observations):
    glu = [o for o in observations if ontology.resolve(o["raw_name"]).canonical_name == "Glicemia de jejum"]
    assert len(glu) == 7
    assert len({o["lab_name"] for o in glu}) == 3
    assert {o["unit"] for o in glu} == {"mg/dL", "mmol/L"}


def test_conversions_known_values(ontology):
    conv = ontology.conversions
    # 5,5 mmol/L de glicose ~ 99 mg/dL
    assert to_canonical(5.5, "mmol/L", "mg/dL", conv["Glicemia de jejum"]) == pytest.approx(99.1, abs=0.2)
    # HbA1c 39 mmol/mol ~ 5,7 %
    assert to_canonical(39, "mmol/mol", "%", conv["Hemoglobina glicada (HbA1c)"]) == pytest.approx(5.72, abs=0.02)
    # unidade ja canonica passa direto; "mu" grego equivale a micro
    assert to_canonical(2.1, "µUI/mL", "mIU/L", conv["TSH"]) == 2.1
    assert to_canonical(2.1, "μUI/mL", "mIU/L", conv["TSH"]) == 2.1
    # unidade desconhecida nao e chutada
    assert to_canonical(1, "furlongs", "mg/dL", conv["Glicemia de jejum"]) is None


def test_series_trend_is_monotonic_after_normalization(ontology, observations):
    """A narrativa da demo: glicemia e HbA1c sobem entre 3 laboratorios diferentes."""
    for name in ("Glicemia de jejum", "Hemoglobina glicada (HbA1c)"):
        bm = ontology.biomarkers[name]
        pts = sorted(
            (
                o["collected_at"],
                to_canonical(float(o["value"]), o["unit"], bm.unit_canonical, ontology.conversions.get(name, {})),
            )
            for o in observations
            if ontology.resolve(o["raw_name"]).canonical_name == name
        )
        vals = [v for _, v in pts]
        assert vals == sorted(vals), f"{name} nao e crescente: {vals}"
