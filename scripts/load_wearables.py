"""Carrega as amostras SINTETICAS do relogio da Marta e gera os alertas (idempotente).

    apps/api/.venv/Scripts/python.exe scripts/load_wearables.py --dry-run   # so mostra o que faria
    apps/api/.venv/Scripts/python.exe scripts/load_wearables.py             # grava (precisa da migration da Fase 5)

Recria SO os dados da paciente de demonstracao (Marta): apaga as amostras com source='synthetic' e os alertas dela,
grava de novo e roda o motor de regras como se hoje fosse 2026-11-12 08:00 (-03:00). Nao imprime segredos.
"""
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from sqlalchemy import text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.repositories.sql import make_engine  # noqa: E402
from app.services.alerts.engine import evaluate, read_samples_csv  # noqa: E402

PATIENT = uuid.UUID("a1000000-0000-4000-8000-000000000001")  # Marta (seed sintetico)
CSV = ROOT / "data" / "synthetic" / "marta" / "wearables.csv"
AS_OF = datetime(2026, 11, 12, 8, 0, tzinfo=timezone(timedelta(hours=-3)))


def main(dry_run: bool) -> None:
    samples = read_samples_csv(CSV)
    alerts = evaluate(samples, AS_OF)
    print(f"{len(samples)} amostras; {len(alerts)} alertas em {AS_OF:%d/%m/%Y %H:%M}:")
    for a in alerts:
        print(f"  [{a.severity:9}] {a.kind:20} | {a.evidence['observed']}")
    if dry_run:
        print("(--dry-run: nada foi gravado)")
        return

    s = get_settings()
    if not s.database_url:
        sys.exit("Falta DATABASE_URL no .env")
    engine = make_engine(s.database_url)
    with engine.begin() as c:  # tudo ou nada
        c.execute(text("delete from public.alerts where patient_id = :p"), {"p": PATIENT})
        c.execute(text("delete from public.wearable_samples where patient_id = :p and source = 'synthetic'"), {"p": PATIENT})
        c.execute(
            text(
                "insert into public.wearable_samples (patient_id, metric, value, unit, recorded_at, source) "
                "values (:p, :m, :v, :u, :t, 'synthetic')"
            ),
            [{"p": PATIENT, "m": x.metric, "v": x.value, "u": x.unit, "t": x.t} for x in samples],
        )
        for a in alerts:
            c.execute(
                text(
                    "insert into public.alerts (patient_id, kind, severity, message, evidence, triggered_at, title, dedupe_key, rule_version) "
                    "values (:p, :k, :s, :m, cast(:e as jsonb), :t, :ti, :d, :rv) "
                    "on conflict (patient_id, kind, dedupe_key) do nothing"
                ),
                {"p": PATIENT, "k": a.kind, "s": a.severity, "m": a.message, "e": json.dumps(a.evidence, ensure_ascii=False),
                 "t": a.triggered_at, "ti": a.title, "d": a.dedupe_key, "rv": a.rule_version},
            )  # fmt: skip
    with engine.connect() as c:
        n_s = c.execute(text("select count(*) from public.wearable_samples where patient_id = :p"), {"p": PATIENT}).scalar()
        n_a = c.execute(text("select count(*) from public.alerts where patient_id = :p"), {"p": PATIENT}).scalar()
    print(f"gravado: {n_s} amostras e {n_a} alertas no banco")


if __name__ == "__main__":
    main("--dry-run" in sys.argv)
