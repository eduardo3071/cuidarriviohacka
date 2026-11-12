"""Gera os dados SINTETICOS do relogio da Marta (90 dias) em data/synthetic/marta/wearables.csv.

    apps/api/.venv/Scripts/python.exe scripts/make_wearables.py

Deterministico (semente fixa): rodar de novo gera o MESMO arquivo. Historia:
  * 2026-08-15 .. 2026-10-21  linha de base estavel (com ruido, um dia atipico, 3 dias sem dados e 1 aviso isolado);
  * 2026-10-22 .. 2026-11-12  EPISODIO: FC de repouso sobe, variabilidade (HRV) cai, oxigenio noturno cai em varias
    noites, sono encurta, pressao domiciliar sobe e o relogio avisa ritmo irregular varias vezes.
Metricas (todas diarias, ~07:00 no fuso -03:00, exceto os avisos de ritmo, que tem a hora do aviso):
  resting_hr (bpm) · hrv_sdnn (ms) · spo2_min (%) minimo da noite · sleep_minutes (min) ·
  systolic / diastolic (mmHg) medida domiciliar · irregular_rhythm_event (1 = aviso do relogio).
Os valores sao INVENTADOS para a demonstracao; os limiares das regras precisam de revisao clinica.
"""
import csv
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "synthetic" / "marta" / "wearables.csv"

TZ = timezone(timedelta(hours=-3))
START, END = date(2026, 8, 15), date(2026, 11, 12)
EPISODE_START = date(2026, 10, 22)
NO_DATA = {date(2026, 9, 3), date(2026, 9, 4), date(2026, 9, 5)}  # relogio sem bateria
OUTLIER_DAY = date(2026, 9, 18)  # um dia atipico (ex.: gripe): nao pode disparar alerta sozinho
STRAY_EVENT = datetime(2026, 9, 10, 3, 20, tzinfo=TZ)  # aviso de ritmo ISOLADO na linha de base
EPISODE_EVENTS = [  # avisos do relogio durante o episodio
    datetime(2026, 10, 24, 3, 12, tzinfo=TZ), datetime(2026, 10, 27, 2, 48, tzinfo=TZ),
    datetime(2026, 10, 30, 4, 5, tzinfo=TZ), datetime(2026, 11, 3, 3, 31, tzinfo=TZ),
    datetime(2026, 11, 6, 2, 55, tzinfo=TZ), datetime(2026, 11, 9, 3, 40, tzinfo=TZ),
]  # fmt: skip


def build() -> list[dict]:
    rng = random.Random(20261112)
    rows: list[dict] = []

    def add(t: datetime, metric: str, value: float, unit: str) -> None:
        rows.append({"recorded_at": t.isoformat(), "metric": metric, "value": value, "unit": unit})

    day = START
    while day <= END:
        if day not in NO_DATA:
            r = 0.0
            if day >= EPISODE_START:  # 0 -> 1 ao longo das 3 semanas do episodio
                r = min(1.0, ((day - EPISODE_START).days + 1) / 21)
            at = datetime(day.year, day.month, day.day, 7, 0, tzinfo=TZ)

            hr = round(rng.gauss(64 + 10 * r, 1.5))
            if day == OUTLIER_DAY:
                hr = 78
            add(at, "resting_hr", hr, "bpm")
            add(at, "hrv_sdnn", round(rng.gauss(42 - 14 * r, 3.5), 1), "ms")

            bad_night = r > 0.45 and rng.random() < 0.6  # queda de oxigenio so no episodio, em varias noites
            add(at, "spo2_min", round(rng.gauss(87.0, 1.4)) if bad_night else round(rng.gauss(93.4, 1.0)), "%")
            add(at, "sleep_minutes", round(rng.gauss(425 - 85 * r, 22)), "min")

            if rng.random() < (0.85 if r > 0 else 0.7):  # pressao domiciliar nem todo dia
                bp = at + timedelta(minutes=30)
                add(bp, "systolic", round(rng.gauss(124 + 18 * r, 4)), "mmHg")
                add(bp, "diastolic", round(rng.gauss(78 + 11 * r, 2.5)), "mmHg")
        day += timedelta(days=1)

    for t in [STRAY_EVENT, *EPISODE_EVENTS]:
        add(t, "irregular_rhythm_event", 1, "evento")
    rows.sort(key=lambda r: (r["recorded_at"], r["metric"]))
    return rows


def main() -> None:
    rows = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["recorded_at", "metric", "value", "unit"])
        w.writeheader()
        w.writerows(rows)
    by: dict[str, int] = {}
    for r in rows:
        by[r["metric"]] = by.get(r["metric"], 0) + 1
    print(f"ok: {len(rows)} amostras {by} -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
