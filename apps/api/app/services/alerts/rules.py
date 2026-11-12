"""Regras DETERMINISTICAS de alerta sobre os dados do relogio. Nenhuma IA decide nada aqui.

Principios:
 * Um alerta nunca e diagnostico: diz o que foi observado e orienta procurar um medico.
 * Todo alerta carrega a EVIDENCIA (regra, observado, janela, pontos, linhas de referencia): a tela
   "por que disparou" so mostra o que o motor usou.
 * Dado insuficiente NAO dispara: sem o minimo de dias/noites a regra fica quieta (melhor calar que alarmar).
 * Comparacoes com a linha de base usam MEDIANA (um dia atipico nao dispara nada sozinho).
"""
from collections import defaultdict
from datetime import datetime, timedelta
from statistics import fmean, median

from .models import (
    DIASTOLIC,
    HRV,
    IRREGULAR,
    RESTING_HR,
    SLEEP,
    SPO2_MIN,
    SYSTOLIC,
    AlertCandidate,
    Sample,
    Thresholds,
)

DISCLAIMER = "Isto não é um diagnóstico: converse com um médico."
SAFETY_NET = "Procure atendimento sem demora se sentir falta de ar, dor no peito, desmaio ou fraqueza de um lado do corpo."

Series = dict[str, list[Sample]]


def group(samples: list[Sample]) -> Series:
    by: Series = defaultdict(list)
    for s in samples:
        by[s.metric].append(s)
    return {m: sorted(v, key=lambda s: s.t) for m, v in by.items()}


def window(by: Series, metric: str, as_of: datetime, days: int, offset_days: int = 0) -> list[Sample]:
    """Amostras em (as_of - offset - days, as_of - offset]."""
    hi = as_of - timedelta(days=offset_days)
    lo = hi - timedelta(days=days)
    return [s for s in by.get(metric, []) if lo < s.t <= hi]


def _dm(t: datetime) -> str:
    return t.strftime("%d/%m")


def _pts(samples: list[Sample]) -> list[dict]:
    return [{"t": s.t.isoformat(), "v": s.value} for s in samples]


def _series(metric: str, unit: str, samples: list[Sample]) -> dict:
    return {"metric": metric, "unit": unit, "points": _pts(samples)}


def _num(x: float) -> str:
    return f"{x:g}".replace(".", ",")


def _candidate(kind: str, severity: str, title: str, message: str, evidence: dict, as_of: datetime) -> AlertCandidate:
    return AlertCandidate(kind, severity, message, evidence, as_of, as_of.date().isoformat(), 1, title)  # type: ignore[arg-type]


# ---------------------------------------------------------------- 1) ritmo irregular (aviso do relogio)
def irregular_rhythm(by: Series, as_of: datetime, th: Thresholds) -> AlertCandidate | None:
    events = window(by, IRREGULAR, as_of, th.irregular_window_days)
    n = len(events)
    if n < th.irregular_min_events:
        return None
    first, last = events[0].t, events[-1].t
    return _candidate(
        "irregular_rhythm", "attention", "Ritmo cardíaco irregular",
        f"O seu relógio avisou ritmo cardíaco irregular {n} vezes nos últimos {th.irregular_window_days} dias. "
        f"{DISCLAIMER} {SAFETY_NET}",
        {
            "rule": f"{th.irregular_min_events} ou mais avisos de ritmo irregular do relógio em {th.irregular_window_days} dias",
            "observed": f"{n} avisos entre {_dm(first)} e {_dm(last)}",
            "window": {"from": (as_of - timedelta(days=th.irregular_window_days)).isoformat(), "to": as_of.isoformat()},
            "series": [_series(IRREGULAR, "evento", events)],
            "note": "O aviso é uma detecção do próprio relógio; este painel apenas conta quantos houve.",
        },
        as_of,
    )  # fmt: skip


# ---------------------------------------------------------------- 2) oxigenio durante o sono
def low_oxygen_sleep(by: Series, as_of: datetime, th: Thresholds) -> AlertCandidate | None:
    nights = window(by, SPO2_MIN, as_of, th.spo2_window_days)
    if len(nights) < th.spo2_min_nights_with_data:
        return None
    low = [s for s in nights if s.value < th.spo2_low_below]
    if len(low) < th.spo2_low_nights_min:
        return None
    return _candidate(
        "low_oxygen_sleep", "attention", "Oxigênio baixo durante o sono",
        f"O oxigênio caiu abaixo de {_num(th.spo2_low_below)}% em {len(low)} das últimas {len(nights)} noites. "
        f"Isso pode ter várias causas. {DISCLAIMER} {SAFETY_NET}",
        {
            "rule": f"mínimo noturno de oxigênio abaixo de {_num(th.spo2_low_below)}% em {th.spo2_low_nights_min} ou mais das últimas {th.spo2_window_days} noites",
            "observed": f"{len(low)} de {len(nights)} noites; menor valor {_num(min(s.value for s in low))}%",
            "window": {"from": (as_of - timedelta(days=th.spo2_window_days)).isoformat(), "to": as_of.isoformat()},
            "series": [_series(SPO2_MIN, "%", nights)],
            "reference_lines": [{"metric": SPO2_MIN, "value": th.spo2_low_below, "label": f"limite da regra: {_num(th.spo2_low_below)}%"}],
        },
        as_of,
    )  # fmt: skip


# ---------------------------------------------------------------- 3) pressao domiciliar
def high_blood_pressure(by: Series, as_of: datetime, th: Thresholds) -> AlertCandidate | None:
    sys_ = {s.t: s for s in window(by, SYSTOLIC, as_of, th.bp_window_days)}
    dia = {s.t: s for s in window(by, DIASTOLIC, as_of, th.bp_window_days)}
    times = sorted(set(sys_) & set(dia))  # so conta medida com as duas pressoes
    if not times:
        return None
    s_list = [sys_[t] for t in times]
    d_list = [dia[t] for t in times]
    ev_base = {
        "window": {"from": (as_of - timedelta(days=th.bp_window_days)).isoformat(), "to": as_of.isoformat()},
        "series": [_series(SYSTOLIC, "mmHg", s_list), _series(DIASTOLIC, "mmHg", d_list)],
    }

    worst = max(zip(s_list, d_list), key=lambda p: (p[0].value >= th.bp_sys_crisis or p[1].value >= th.bp_dia_crisis, p[0].value))
    if worst[0].value >= th.bp_sys_crisis or worst[1].value >= th.bp_dia_crisis:
        s, d = worst
        return _candidate(
            "high_blood_pressure", "urgent", "Pressão muito alta",
            f"Uma medida de pressão ({_num(s.value)}/{_num(d.value)} mmHg em {_dm(s.t)}) está muito alta. "
            f"Procure atendimento médico agora, principalmente com dor de cabeça forte, dor no peito ou falta de ar. {DISCLAIMER}",
            {
                **ev_base,
                "rule": f"qualquer medida com sistólica ≥ {_num(th.bp_sys_crisis)} ou diastólica ≥ {_num(th.bp_dia_crisis)} mmHg",
                "observed": f"{_num(s.value)}/{_num(d.value)} mmHg em {_dm(s.t)}",
                "reference_lines": [
                    {"metric": SYSTOLIC, "value": th.bp_sys_crisis, "label": f"limite urgente: {_num(th.bp_sys_crisis)}"},
                    {"metric": DIASTOLIC, "value": th.bp_dia_crisis, "label": f"limite urgente: {_num(th.bp_dia_crisis)}"},
                ],
            },
            as_of,
        )  # fmt: skip

    if len(times) < th.bp_min_readings:
        return None
    ms, md = fmean(s.value for s in s_list), fmean(d.value for d in d_list)
    if ms < th.bp_sys_high and md < th.bp_dia_high:
        return None
    return _candidate(
        "high_blood_pressure", "attention", "Pressão acima do esperado",
        f"A média das suas medidas de pressão nos últimos {th.bp_window_days} dias foi {_num(round(ms))}/{_num(round(md))} mmHg. "
        f"{DISCLAIMER}",
        {
            **ev_base,
            "rule": f"média de {th.bp_window_days} dias com sistólica ≥ {_num(th.bp_sys_high)} ou diastólica ≥ {_num(th.bp_dia_high)} mmHg (mínimo {th.bp_min_readings} medidas)",
            "observed": f"média {_num(round(ms))}/{_num(round(md))} mmHg em {len(times)} medidas",
            "reference_lines": [
                {"metric": SYSTOLIC, "value": th.bp_sys_high, "label": f"limite da regra: {_num(th.bp_sys_high)}"},
                {"metric": DIASTOLIC, "value": th.bp_dia_high, "label": f"limite da regra: {_num(th.bp_dia_high)}"},
            ],
        },
        as_of,
    )  # fmt: skip


# ---------------------------------------------------------------- 4) FC de repouso subindo
def resting_hr_rise(by: Series, as_of: datetime, th: Thresholds) -> AlertCandidate | None:
    recent = window(by, RESTING_HR, as_of, th.rhr_recent_days)
    base = window(by, RESTING_HR, as_of, th.rhr_baseline_days, offset_days=th.rhr_recent_days + th.baseline_gap_days)
    if len(recent) < th.rhr_min_recent or len(base) < th.rhr_min_baseline:
        return None
    mr, mb = median(s.value for s in recent), median(s.value for s in base)
    rise = mr - mb
    if rise < th.rhr_rise_info:
        return None
    sev = "attention" if rise >= th.rhr_rise_attention else "info"
    whole = window(by, RESTING_HR, as_of, th.rhr_recent_days + th.baseline_gap_days + th.rhr_baseline_days)
    return _candidate(
        "resting_hr_rise", sev, "Frequência cardíaca de repouso subiu",
        f"A sua frequência cardíaca em repouso está {_num(round(rise))} bpm acima do seu padrão "
        f"({_num(round(mr))} contra {_num(round(mb))} bpm). {DISCLAIMER}",
        {
            "rule": f"mediana da última semana pelo menos {_num(th.rhr_rise_info)} bpm acima da mediana do seu padrão ({th.rhr_baseline_days} dias, terminando {th.rhr_recent_days + th.baseline_gap_days} dias atrás)",
            "observed": f"{_num(round(mr))} bpm contra {_num(round(mb))} bpm (+{_num(round(rise))})",
            "window": {"from": (as_of - timedelta(days=th.rhr_recent_days + th.baseline_gap_days + th.rhr_baseline_days)).isoformat(), "to": as_of.isoformat()},
            "series": [_series(RESTING_HR, "bpm", whole)],
            "baseline": {"metric": RESTING_HR, "value": mb, "label": f"seu padrão: {_num(round(mb))} bpm"},
        },
        as_of,
    )  # fmt: skip


# ---------------------------------------------------------------- 5) variabilidade (HRV) caindo
def hrv_drop(by: Series, as_of: datetime, th: Thresholds) -> AlertCandidate | None:
    recent = window(by, HRV, as_of, th.rhr_recent_days)
    base = window(by, HRV, as_of, th.rhr_baseline_days, offset_days=th.rhr_recent_days + th.baseline_gap_days)
    if len(recent) < th.rhr_min_recent or len(base) < th.rhr_min_baseline:
        return None
    mr, mb = median(s.value for s in recent), median(s.value for s in base)
    if mb <= 0 or mr / mb > th.hrv_ratio_info:
        return None
    sev = "attention" if mr / mb <= th.hrv_ratio_attention else "info"
    whole = window(by, HRV, as_of, th.rhr_recent_days + th.baseline_gap_days + th.rhr_baseline_days)
    return _candidate(
        "hrv_drop", sev, "Variabilidade cardíaca caiu",
        f"A variabilidade da sua frequência cardíaca está {_num(round((1 - mr / mb) * 100))}% abaixo do seu padrão. "
        f"{DISCLAIMER}",
        {
            "rule": f"mediana da última semana igual ou abaixo de {_num(th.hrv_ratio_info * 100)}% da mediana do seu padrão ({th.rhr_baseline_days} dias, terminando {th.rhr_recent_days + th.baseline_gap_days} dias atrás)",
            "observed": f"{_num(round(mr))} ms contra {_num(round(mb))} ms ({_num(round(mr / mb * 100))}% do padrão)",
            "window": {"from": (as_of - timedelta(days=th.rhr_recent_days + th.baseline_gap_days + th.rhr_baseline_days)).isoformat(), "to": as_of.isoformat()},
            "series": [_series(HRV, "ms", whole)],
            "baseline": {"metric": HRV, "value": mb, "label": f"seu padrão: {_num(round(mb))} ms"},
        },
        as_of,
    )  # fmt: skip


# ---------------------------------------------------------------- 6) sono mais curto
def sleep_reduction(by: Series, as_of: datetime, th: Thresholds) -> AlertCandidate | None:
    recent = window(by, SLEEP, as_of, th.rhr_recent_days)
    base = window(by, SLEEP, as_of, th.rhr_baseline_days, offset_days=th.rhr_recent_days + th.baseline_gap_days)
    if len(recent) < th.sleep_min_recent or len(base) < th.sleep_min_baseline:
        return None
    mr, mb = fmean(s.value for s in recent), fmean(s.value for s in base)
    if mr >= th.sleep_recent_below or mb - mr < th.sleep_drop_min:
        return None
    whole = window(by, SLEEP, as_of, th.rhr_recent_days + th.baseline_gap_days + th.rhr_baseline_days)
    return _candidate(
        "sleep_reduction", "info", "Sono mais curto",
        f"Você está dormindo em média {_num(round(mr / 60, 1))} h por noite, contra {_num(round(mb / 60, 1))} h no seu padrão. "
        f"{DISCLAIMER}",
        {
            "rule": f"média da última semana abaixo de {_num(th.sleep_recent_below / 60)} h e pelo menos {_num(th.sleep_drop_min)} min menor que o seu padrão",
            "observed": f"{_num(round(mr / 60, 1))} h contra {_num(round(mb / 60, 1))} h",
            "window": {"from": (as_of - timedelta(days=th.rhr_recent_days + th.baseline_gap_days + th.rhr_baseline_days)).isoformat(), "to": as_of.isoformat()},
            "series": [_series(SLEEP, "min", whole)],
            "reference_lines": [{"metric": SLEEP, "value": th.sleep_recent_below, "label": f"limite da regra: {_num(th.sleep_recent_below / 60)} h"}],
            "baseline": {"metric": SLEEP, "value": mb, "label": f"seu padrão: {_num(round(mb / 60, 1))} h"},
        },
        as_of,
    )  # fmt: skip


RULES = (irregular_rhythm, low_oxygen_sleep, high_blood_pressure, resting_hr_rise, hrv_drop, sleep_reduction)
