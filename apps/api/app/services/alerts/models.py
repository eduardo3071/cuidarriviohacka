from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

Severity = Literal["info", "attention", "urgent"]

# Nomes das metricas em wearable_samples.metric
RESTING_HR = "resting_hr"  # bpm, diaria
HRV = "hrv_sdnn"  # ms, diaria
SPO2_MIN = "spo2_min"  # %, minimo da noite
SLEEP = "sleep_minutes"  # min, total da noite
SYSTOLIC = "systolic"  # mmHg, medida domiciliar
DIASTOLIC = "diastolic"
IRREGULAR = "irregular_rhythm_event"  # 1 = aviso do relogio (a deteccao e do DISPOSITIVO, nao nossa)


@dataclass(frozen=True)
class Sample:
    t: datetime  # com fuso
    metric: str
    value: float
    unit: str | None = None


@dataclass(frozen=True)
class Thresholds:
    """Limiares das regras. SAO PARAMETROS DE DEMONSTRACAO: precisam de revisao clinica antes de qualquer uso real.
    Cada valor esta aqui, em um unico lugar, justamente para ser revisado e ajustado sem mexer nas regras."""

    # ritmo irregular: o AVISO e do relogio; a regra so conta quantos houve
    irregular_min_events: int = 2
    irregular_window_days: int = 14
    # oxigenio durante o sono
    spo2_low_below: float = 90.0
    spo2_low_nights_min: int = 3
    spo2_window_days: int = 7
    spo2_min_nights_with_data: int = 4
    # pressao domiciliar (media dos ultimos dias)
    bp_window_days: int = 7
    bp_min_readings: int = 4
    bp_sys_high: float = 135.0
    bp_dia_high: float = 85.0
    bp_sys_crisis: float = 180.0  # qualquer medida a partir disso (ou diastolica >= crisis) e URGENTE
    bp_dia_crisis: float = 120.0
    # frequencia cardiaca de repouso: mediana da ultima semana contra a mediana das 4 semanas anteriores
    rhr_recent_days: int = 7
    rhr_baseline_days: int = 28
    # folga entre a semana recente e a linha de base: sem ela, um episodio que ja dura dias CONTAMINA o proprio
    # padrao e a comparacao some (medido: FC de repouso 65 bpm de base com folga 0 contra 64 com folga 7).
    # Limite conhecido: uma deriva mais longa que (recente + folga) ainda contamina a base.
    baseline_gap_days: int = 7
    rhr_rise_info: float = 8.0
    rhr_rise_attention: float = 12.0
    rhr_min_recent: int = 5
    rhr_min_baseline: int = 14
    # variabilidade (HRV): razao da mediana recente sobre a da linha de base
    hrv_ratio_info: float = 0.70
    hrv_ratio_attention: float = 0.55
    # sono: media da ultima semana
    sleep_recent_below: float = 360.0
    sleep_drop_min: float = 45.0
    sleep_min_recent: int = 5
    sleep_min_baseline: int = 14


@dataclass
class AlertCandidate:
    kind: str
    severity: Severity
    message: str
    evidence: dict
    triggered_at: datetime
    dedupe_key: str  # data da avaliacao: reavaliar o mesmo dia nao duplica
    rule_version: int = 1
    title: str = field(default="")
