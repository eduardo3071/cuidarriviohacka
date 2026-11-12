"""Dados de demonstracao do front: sem deriva e concordando com a view SQL verificada no banco real."""
import json
import sys
from collections import Counter
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

import build_demo_data  # noqa: E402

from app.services.normalization.ontology import load_ontology  # noqa: E402
from app.services.normalization.series import build_points, reference_digest  # noqa: E402

# Obtidos do banco REAL (Supabase Rivio-Hackathon) em 2026-11-12, rodando a view observation_series
# sobre as 75 leituras do seed (teste desfeito). Se o seed ou a regra mudarem, atualize junto com a view.
SQL_DIGEST = "74a8f84616430517f56543e4ab4c563c"
SQL_NORMALIZATION = {"canonical": 60, "converted": 15}
SQL_FLAGS = {"above": 23, "below": 2, "in_range": 50}
SQL_TIMELINE = {"exam": 7, "encounter": 7, "medication_start": 2, "vaccine": 12}  # verificado no banco real
ALERTS_IN_DEMO = 5  # gerados pelo motor de regras (o banco so os tem depois de scripts/load_wearables.py)


@pytest.fixture(scope="module")
def built():
    return build_demo_data.build()


def test_committed_demo_file_is_up_to_date(built):
    committed = json.loads(build_demo_data.OUT.read_text(encoding="utf-8"))
    assert committed == built, "rode: python scripts/build_demo_data.py"


def test_python_reference_matches_the_sql_view_digest():
    import csv

    onto = load_ontology(ROOT / "data" / "ontology")
    with open(ROOT / "data" / "synthetic" / "marta" / "observations.csv", encoding="utf-8", newline="") as f:
        rows = [{**r, "ref_low": r["ref_low"] or None, "ref_high": r["ref_high"] or None} for r in csv.DictReader(f)]
    assert reference_digest(build_points(rows, onto)) == SQL_DIGEST


def test_counts_match_what_the_sql_views_returned(built):
    assert len(built["points"]) == 75
    assert Counter(p["normalization"] for p in built["points"]) == SQL_NORMALIZATION
    assert Counter(p["flag"] for p in built["points"]) == SQL_FLAGS
    assert Counter(e["kind"] for e in built["events"]) == {**SQL_TIMELINE, "alert": ALERTS_IN_DEMO}


def test_rows_use_the_view_column_names(built):
    expected = {
        "biomarker", "category", "unit_canonical", "collected_at", "lab_name", "raw_name", "raw_value", "raw_unit",
        "raw_ref_low", "raw_ref_high", "ref_text", "normalization", "value", "ref_low", "ref_high", "flag",
    }  # fmt: skip
    assert all(set(p) == expected for p in built["points"])
    assert all(set(e) == {"event_date", "kind", "title", "detail"} for e in built["events"])


def test_demo_is_flagged_synthetic(built):
    assert built["synthetic"] is True and "SINTETICOS" in built["note"]


def test_wearables_and_alerts_are_in_the_demo(built):
    assert len(built["wearables"]) == 489
    assert {a["kind"] for a in built["alerts"]} == {
        "high_blood_pressure", "irregular_rhythm", "low_oxygen_sleep", "resting_hr_rise", "sleep_reduction",
    }  # fmt: skip
    assert all(a["evidence"]["rule"] and a["evidence"]["series"] for a in built["alerts"])
    alert_events = [e for e in built["events"] if e["kind"] == "alert"]
    assert len(alert_events) == len(built["alerts"]) and all(e["event_date"] == "2026-11-12" for e in alert_events)
