"""Dados SINTETICOS do relogio da Marta + o motor de alertas sobre eles (a historia da demonstracao)."""
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

import make_wearables  # noqa: E402

from app.services.alerts.engine import backtest, evaluate, read_samples_csv  # noqa: E402

TZ = timezone(timedelta(hours=-3))
AS_OF = datetime(2026, 11, 12, 8, 0, tzinfo=TZ)
EPISODE_START = date(2026, 10, 22)


@pytest.fixture(scope="module")
def samples():
    return read_samples_csv(make_wearables.OUT)


@pytest.fixture(scope="module")
def timeline(samples):
    # a regra de linha de base precisa de 42 dias de historico: a 1a avaliacao completa e 2026-09-28
    return backtest(samples, date(2026, 9, 28), date(2026, 11, 12))


def test_committed_csv_is_up_to_date_and_deterministic():
    rows = make_wearables.build()
    assert rows == make_wearables.build(), "o gerador tem de ser deterministico"
    with open(make_wearables.OUT, encoding="utf-8", newline="") as f:
        import csv

        committed = [{**r, "value": float(r["value"])} for r in csv.DictReader(f)]
    assert [{**r, "value": float(r["value"])} for r in rows] == committed, "rode: python scripts/make_wearables.py"


def test_shape_of_the_data(samples):
    assert len(samples) == 489
    assert Counter(s.metric for s in samples) == {
        "resting_hr": 87, "hrv_sdnn": 87, "spo2_min": 87, "sleep_minutes": 87,
        "systolic": 67, "diastolic": 67, "irregular_rhythm_event": 7,
    }  # fmt: skip
    assert all(s.t.utcoffset() == timedelta(hours=-3) for s in samples), "todas com fuso"
    assert {s.t.date() for s in samples if s.metric == "resting_hr"}.isdisjoint(make_wearables.NO_DATA)


def test_the_story_is_in_the_data(samples):
    def med(metric, lo, hi):
        from statistics import median

        return median(s.value for s in samples if s.metric == metric and lo <= s.t.date() <= hi)

    base, last = (date(2026, 9, 21), date(2026, 10, 21)), (date(2026, 11, 6), date(2026, 11, 12))
    assert med("resting_hr", *last) - med("resting_hr", *base) >= 6
    assert med("hrv_sdnn", *last) < med("hrv_sdnn", *base) * 0.8
    assert med("sleep_minutes", *last) < med("sleep_minutes", *base) - 50
    assert med("systolic", *last) > med("systolic", *base) + 10


def test_baseline_has_zero_false_alarms_even_with_noise_outlier_gap_and_a_stray_warning(timeline):
    """Dias avaliados ANTES do episodio: ruido, 1 dia atipico (FC 78), 3 dias sem dados e 1 aviso isolado."""
    baseline = {d: k for d, k in timeline.items() if d < EPISODE_START}
    assert len(baseline) >= 20
    assert {d: k for d, k in baseline.items() if k} == {}, "nenhum alerta na linha de base"


def test_the_episode_is_detected_with_the_three_signals_of_the_challenge(samples):
    kinds = {c.kind for c in evaluate(samples, AS_OF)}
    assert {"irregular_rhythm", "low_oxygen_sleep", "high_blood_pressure"} <= kinds


def test_detection_delay_is_reported_not_hidden(timeline):
    """Atraso entre o inicio do episodio (22/10) e o 1o disparo de cada regra. Documenta, nao promete."""
    first: dict[str, date] = {}
    for d, kinds in sorted(timeline.items()):
        for k in kinds:
            first.setdefault(k, d)
    delay = {k: (d - EPISODE_START).days for k, d in first.items()}
    assert delay["irregular_rhythm"] == 5  # 2o aviso de ritmo (27/10)
    assert delay["low_oxygen_sleep"] <= 14
    assert delay["high_blood_pressure"] <= 21
    assert all(v >= 0 for v in delay.values()), "nenhum alerta ANTES do episodio"


def test_a_stray_warning_never_alerts_on_its_own(samples):
    stray = make_wearables.STRAY_EVENT
    for days_after in range(0, 14):
        as_of = datetime.combine(stray.date() + timedelta(days=days_after), datetime.min.time(), tzinfo=TZ).replace(hour=8)
        assert "irregular_rhythm" not in {c.kind for c in evaluate(samples, as_of)}


def test_days_without_watch_data_do_not_crash_or_alert(samples):
    for d in make_wearables.NO_DATA:
        assert evaluate(samples, datetime.combine(d, datetime.min.time(), tzinfo=TZ).replace(hour=8)) == []
