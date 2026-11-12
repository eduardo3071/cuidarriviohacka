"""Regras de alerta do relogio: limites exatos, dado insuficiente, robustez, evidencia e linguagem.

Os limiares sao de DEMONSTRACAO (precisam de revisao clinica); estes testes travam o COMPORTAMENTO das regras
em cada fronteira, para que ajustar um limiar mude so o numero e nunca o jeito de decidir.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.alerts.engine import drop_in_cooldown, evaluate
from app.services.alerts.models import (
    DIASTOLIC,
    HRV,
    IRREGULAR,
    RESTING_HR,
    SLEEP,
    SPO2_MIN,
    SYSTOLIC,
    Sample,
    Thresholds,
)

TZ = timezone(timedelta(hours=-3))
AS_OF = datetime(2026, 11, 12, 8, 0, tzinfo=TZ)


def at(days_ago: int, hour: int = 7, minute: int = 0) -> datetime:
    return (AS_OF - timedelta(days=days_ago)).replace(hour=hour, minute=minute)


def daily(metric: str, values: list[float], end_ago: int = 0, unit: str = "x") -> list[Sample]:
    """Um valor por dia; o ULTIMO da lista cai `end_ago` dias atras (0 = hoje)."""
    n = len(values)
    return [Sample(at(end_ago + n - 1 - i), metric, v, unit) for i, v in enumerate(values)]


def bp(readings: list[tuple[float, float]], end_ago: int = 0) -> list[Sample]:
    out = []
    n = len(readings)
    for i, (s, d) in enumerate(readings):
        t = at(end_ago + n - 1 - i, 7, 30)
        out += [Sample(t, SYSTOLIC, s, "mmHg"), Sample(t, DIASTOLIC, d, "mmHg")]
    return out


def events(*days_ago: int) -> list[Sample]:
    return [Sample(at(d, 3, 10), IRREGULAR, 1, "evento") for d in days_ago]


def kinds(samples: list[Sample], th: Thresholds | None = None) -> set[str]:
    return {c.kind for c in evaluate(samples, AS_OF, th)}


def one(samples: list[Sample], kind: str, th: Thresholds | None = None):
    found = [c for c in evaluate(samples, AS_OF, th) if c.kind == kind]
    return found[0] if found else None


# ================================================================ ritmo irregular
def test_irregular_needs_two_events_in_the_window():
    assert one(events(3), "irregular_rhythm") is None, "1 aviso isolado nao alerta"
    c = one(events(3, 9), "irregular_rhythm")
    assert c and c.severity == "attention" and "2 vezes" in c.message
    assert one(events(3, 15), "irregular_rhythm") is None, "o aviso de 15 dias atras ja saiu da janela de 14"
    assert one(events(3, 13), "irregular_rhythm") is not None


def test_irregular_evidence_lists_the_events_and_says_the_device_detected_them():
    c = one(events(2, 5, 8), "irregular_rhythm")
    assert len(c.evidence["series"][0]["points"]) == 3
    assert c.evidence["observed"].startswith("3 avisos entre ")
    assert "do próprio relógio" in c.evidence["note"], "a deteccao e do dispositivo, nao do painel"


# ================================================================ oxigenio durante o sono
def test_low_oxygen_boundaries():
    assert one(daily(SPO2_MIN, [93, 88, 93, 89, 93, 93, 93]), "low_oxygen_sleep") is None, "2 noites baixas"
    assert one(daily(SPO2_MIN, [93, 88, 93, 89, 93, 87, 93]), "low_oxygen_sleep") is not None, "3 noites baixas"
    assert one(daily(SPO2_MIN, [90, 90, 90, 90, 90, 90, 90]), "low_oxygen_sleep") is None, "90 nao e abaixo de 90"


def test_low_oxygen_stays_quiet_without_enough_nights():
    assert one(daily(SPO2_MIN, [85, 85, 85]), "low_oxygen_sleep") is None, "so 3 noites de dado: calar"
    assert one(daily(SPO2_MIN, [85, 85, 85, 85]), "low_oxygen_sleep") is not None


def test_low_oxygen_evidence_has_the_reference_line():
    c = one(daily(SPO2_MIN, [86, 87, 88, 93, 93, 93, 93]), "low_oxygen_sleep")
    assert c.evidence["reference_lines"][0]["value"] == 90 and "3 de 7 noites" in c.evidence["observed"]


# ================================================================ pressao
@pytest.mark.parametrize(
    "readings,expect",
    [
        ([(134, 84)] * 5, None),  # logo abaixo dos dois limites
        ([(135, 80)] * 5, "attention"),  # sistolica no limite
        ([(120, 85)] * 5, "attention"),  # diastolica no limite
        ([(150, 95)] * 3, None),  # alta mas so 3 medidas: calar
        ([(150, 95)] * 4, "attention"),
    ],
)
def test_blood_pressure_mean_rule(readings, expect):
    c = one(bp(readings), "high_blood_pressure")
    assert (c.severity if c else None) == expect


@pytest.mark.parametrize("reading", [(180, 90), (150, 120)])
def test_a_single_crisis_reading_is_urgent_even_alone(reading):
    c = one(bp([reading]), "high_blood_pressure")
    assert c.severity == "urgent" and "atendimento médico agora" in c.message


def test_unpaired_readings_are_ignored():
    only_sys = [Sample(at(i, 7, 30), SYSTOLIC, 190, "mmHg") for i in range(5)]
    assert one(only_sys, "high_blood_pressure") is None, "sem a diastolica nao e uma medida"


# ================================================================ FC de repouso, HRV, sono: contra a linha de base
def history(metric: str, base: float, recent: float, n_recent: int = 7, n_base: int = 28, gap_value: float | None = None):
    """Linha de base 14..41 dias atras; folga 7..13 (opcional); recente 0..6 dias atras."""
    s = daily(metric, [base] * n_base, end_ago=14)
    if gap_value is not None:
        s += daily(metric, [gap_value] * 7, end_ago=7)
    return s + daily(metric, [recent] * n_recent, end_ago=0)


@pytest.mark.parametrize("recent,expect", [(71, None), (72, "info"), (75, "info"), (76, "attention")])
def test_resting_hr_rise_thresholds(recent, expect):
    c = one(history(RESTING_HR, 64, recent), "resting_hr_rise")
    assert (c.severity if c else None) == expect


def test_resting_hr_one_odd_day_does_not_fire_because_it_uses_the_median():
    samples = history(RESTING_HR, 64, 64) + [Sample(at(2), RESTING_HR, 120, "bpm")]  # um dia de febre
    assert one(samples, "resting_hr_rise") is None


def test_baseline_leaves_a_gap_so_a_running_episode_does_not_hide_itself():
    """Episodio com 3 semanas (dias 0..20 atras) sobre um padrao normal de 64 bpm (dias 21..48).

    Sem folga, a linha de base (dias 7..34) fica METADE contaminada: a mediana vai a 68,5 e a subida de 9 bpm some
    (+4,5). Com folga de 7 dias (dias 14..41) so 7 de 28 dias estao contaminados: a mediana segue 64 e alerta.
    (Uma contaminacao de 25% ainda nao move a mediana: o ganho da folga e para episodios mais longos.)"""
    samples = daily(RESTING_HR, [64] * 28, end_ago=21) + daily(RESTING_HR, [73] * 14, end_ago=7) + daily(RESTING_HR, [73] * 7)
    with_gap = one(samples, "resting_hr_rise")
    assert with_gap is not None and "+9" in with_gap.evidence["observed"]
    assert one(samples, "resting_hr_rise", Thresholds(baseline_gap_days=0)) is None, "sem a folga, a base se contamina"


def test_a_short_contamination_is_absorbed_by_the_median_even_without_a_gap():
    samples = history(RESTING_HR, 64, 73, gap_value=73)  # so 7 dias elevados na janela de 28
    assert one(samples, "resting_hr_rise") is not None
    assert one(samples, "resting_hr_rise", Thresholds(baseline_gap_days=0)) is not None


def test_baseline_rules_need_enough_data():
    assert one(history(RESTING_HR, 64, 80, n_recent=4), "resting_hr_rise") is None, "so 4 dias recentes"
    assert one(history(RESTING_HR, 64, 80, n_base=13), "resting_hr_rise") is None, "base curta demais"
    assert one(history(RESTING_HR, 64, 80, n_recent=5, n_base=14), "resting_hr_rise") is not None


@pytest.mark.parametrize("recent,expect", [(29.6, None), (28, "info"), (22, "attention")])
def test_hrv_drop_thresholds(recent, expect):
    c = one(history(HRV, 40, recent), "hrv_drop")  # 28/40 = 0,70 ; 22/40 = 0,55
    assert (c.severity if c else None) == expect


@pytest.mark.parametrize("recent,base,expect", [(359, 425, True), (361, 425, False), (350, 380, False)])
def test_sleep_reduction(recent, base, expect):
    assert (one(history(SLEEP, base, recent), "sleep_reduction") is not None) == expect


# ================================================================ motor
def test_engine_never_looks_into_the_future():
    future = [Sample(AS_OF + timedelta(days=d), IRREGULAR, 1, "evento") for d in (1, 2, 3)]
    assert kinds(future) == set()


def test_engine_orders_most_severe_first():
    samples = bp([(185, 100)]) + events(1, 2) + history(RESTING_HR, 64, 72)
    sev = [c.severity for c in evaluate(samples, AS_OF)]
    assert sev == sorted(sev, key=["urgent", "attention", "info"].index) and sev[0] == "urgent"


def test_no_data_no_alerts():
    assert evaluate([], AS_OF) == []


def test_cooldown_does_not_repeat_the_same_alert_every_day():
    cands = evaluate(events(1, 2), AS_OF)
    assert [c.kind for c in cands] == ["irregular_rhythm"]
    recent = [("irregular_rhythm", AS_OF - timedelta(days=3))]
    assert drop_in_cooldown(cands, recent) == []
    old = [("irregular_rhythm", AS_OF - timedelta(days=7))]
    assert drop_in_cooldown(cands, old) == cands, "passou a janela de espera"
    assert drop_in_cooldown(cands, [("low_oxygen_sleep", AS_OF)]) == cands, "outro tipo nao conta"


def test_dedupe_key_is_the_evaluation_date():
    c = evaluate(events(1, 2), AS_OF)[0]
    assert c.dedupe_key == "2026-11-12" and c.triggered_at == AS_OF


# ================================================================ linguagem e evidencia de TODOS os alertas
def everything_fires() -> list[Sample]:
    return (
        events(1, 3, 6)
        + daily(SPO2_MIN, [86, 87, 88, 89, 93, 93, 93])
        + bp([(142, 91)] * 6)
        + history(RESTING_HR, 64, 78)
        + history(HRV, 42, 24)
        + history(SLEEP, 425, 330)
    )


FORBIDDEN = ["você tem", "voce tem", "fibrilação", "fibrilacao", "apneia", "hipertensão", "hipertensao", "infarto", "avc", "diagnosticado"]


def test_every_kind_can_fire_and_never_diagnoses():
    found = evaluate(everything_fires(), AS_OF)
    assert {c.kind for c in found} == {
        "irregular_rhythm", "low_oxygen_sleep", "high_blood_pressure", "resting_hr_rise", "hrv_drop", "sleep_reduction",
    }  # fmt: skip
    for c in found:
        low = c.message.lower()
        assert "médico" in low, f"{c.kind}: toda mensagem orienta procurar um medico"
        assert "não é um diagnóstico" in low, c.kind
        assert not any(w in low for w in FORBIDDEN), f"{c.kind}: a mensagem nao pode diagnosticar: {c.message}"


def test_every_alert_carries_the_evidence_the_screen_needs():
    for c in evaluate(everything_fires(), AS_OF):
        ev = c.evidence
        assert ev["rule"] and ev["observed"] and ev["window"]["from"] < ev["window"]["to"], c.kind
        assert ev["series"] and all(s["points"] for s in ev["series"]), c.kind
        for s in ev["series"]:
            for p in s["points"]:
                datetime.fromisoformat(p["t"])
                assert isinstance(p["v"], (int, float))
        assert c.title and c.severity in ("info", "attention", "urgent")
