import csv
from collections.abc import Iterable
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from .models import AlertCandidate, Sample, Thresholds
from .rules import RULES, group

_SEVERITY_ORDER = {"urgent": 0, "attention": 1, "info": 2}


def evaluate(samples: list[Sample], as_of: datetime, th: Thresholds | None = None) -> list[AlertCandidate]:
    """Roda todas as regras com os dados ATE `as_of` (nunca olha o futuro). Mais grave primeiro."""
    th = th or Thresholds()
    by = group([s for s in samples if s.t <= as_of])
    found = [c for rule in RULES if (c := rule(by, as_of, th)) is not None]
    return sorted(found, key=lambda c: (_SEVERITY_ORDER[c.severity], c.kind))


def drop_in_cooldown(
    candidates: list[AlertCandidate], existing: Iterable[tuple[str, datetime]], cooldown_days: int = 7
) -> list[AlertCandidate]:
    """Nao repete um alerta do mesmo tipo dentro da janela de espera (senao a mesma condicao alarma todo dia)."""
    last: dict[str, datetime] = {}
    for kind, when in existing:
        if kind not in last or when > last[kind]:
            last[kind] = when
    return [c for c in candidates if c.kind not in last or c.triggered_at - last[c.kind] >= timedelta(days=cooldown_days)]


def backtest(
    samples: list[Sample], first_day: date, last_day: date, hour: int = 8, tz: timezone = timezone(timedelta(hours=-3)),
    th: Thresholds | None = None,
) -> dict[date, list[str]]:  # fmt: skip
    """Avalia dia a dia (as 08:00) usando so o que existia ate aquele momento: mede quando cada regra dispararia."""
    out: dict[date, list[str]] = {}
    d = first_day
    while d <= last_day:
        out[d] = [c.kind for c in evaluate(samples, datetime.combine(d, time(hour), tzinfo=tz), th)]
        d += timedelta(days=1)
    return out


def read_samples_csv(path: Path) -> list[Sample]:
    with open(path, encoding="utf-8", newline="") as f:
        return [
            Sample(datetime.fromisoformat(r["recorded_at"]), r["metric"], float(r["value"]), r["unit"] or None)
            for r in csv.DictReader(f)
        ]
