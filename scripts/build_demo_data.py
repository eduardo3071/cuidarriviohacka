"""Gera os dados de DEMONSTRACAO do front (paciente sintetica Marta), no formato exato das views
`observation_series` e `timeline_events`. Assim o front le o mesmo formato do Supabase e do modo demo.

    apps/api/.venv/Scripts/python.exe scripts/build_demo_data.py

Saida: apps/web/src/demo/marta.json  (DADOS 100% SINTETICOS)
Usa a normalizacao de REFERENCIA (Decimal); a view SQL e conferida contra ela por hash.
"""
import csv
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.services.alerts.engine import evaluate, read_samples_csv  # noqa: E402
from app.services.normalization.ontology import load_ontology  # noqa: E402
from app.services.normalization.series import SeriesPoint, build_points  # noqa: E402

DATA = ROOT / "data"
OUT = ROOT / "apps" / "web" / "src" / "demo" / "marta.json"
AS_OF = datetime(2026, 11, 12, 8, 0, tzinfo=timezone(timedelta(hours=-3)))  # "hoje" da demonstracao


def _num(x):
    return None if x is None else float(x)


def point_row(p: SeriesPoint, category: str | None) -> dict:
    """Mesmas colunas (e nomes) da view observation_series que o front consome."""
    return {
        "biomarker": p.biomarker,
        "category": category,
        "unit_canonical": p.unit_canonical,
        "collected_at": p.collected_at.isoformat(),
        "lab_name": p.lab_name,
        "raw_name": p.raw_name,
        "raw_value": _num(p.raw_value),
        "raw_unit": p.raw_unit,
        "raw_ref_low": _num(p.raw_ref_low),
        "raw_ref_high": _num(p.raw_ref_high),
        "ref_text": p.ref_text,
        "normalization": p.normalization,
        "value": _num(p.value),
        "ref_low": _num(p.ref_low),
        "ref_high": _num(p.ref_high),
        "flag": p.flag,
    }


def build() -> dict:
    onto = load_ontology(DATA / "ontology")
    base = DATA / "synthetic" / "marta"
    patient = json.loads((base / "patient.json").read_text(encoding="utf-8"))
    with open(base / "observations.csv", encoding="utf-8", newline="") as f:
        rows = [{**r, "ref_low": r["ref_low"] or None, "ref_high": r["ref_high"] or None} for r in csv.DictReader(f)]
    points = build_points(rows, onto)

    rows_out = sorted(
        (point_row(p, onto.biomarkers[p.biomarker].category if p.biomarker else None) for p in points),
        key=lambda r: (r["biomarker"] or "", r["collected_at"], r["raw_name"]),
    )

    # eventos no formato da view timeline_events (exames agrupados por data + laboratorio)
    exams = Counter()
    out_of_range = Counter()
    for p in points:
        key = (p.collected_at.isoformat(), p.lab_name)
        exams[key] += 1
        out_of_range[key] += p.flag in ("above", "below")
    events = [
        {"event_date": d, "kind": "exam", "title": lab or "Exame",
         "detail": {"document_id": None, "results": n, "out_of_range": out_of_range[(d, lab)]}}
        for (d, lab), n in exams.items()
    ]  # fmt: skip
    events += [
        {"event_date": e["occurred_at"], "kind": "encounter", "title": e.get("specialty") or "Consulta",
         "detail": {"provider": e.get("provider"), "notes": e.get("notes")}}
        for e in patient["encounters"]
    ]  # fmt: skip
    for m in patient["medications"]:
        if m.get("started_at"):
            events.append({"event_date": m["started_at"], "kind": "medication_start", "title": m["name"], "detail": {"dose": m.get("dose")}})
        if m.get("ended_at"):
            events.append({"event_date": m["ended_at"], "kind": "medication_end", "title": m["name"], "detail": {"dose": m.get("dose")}})
    events += [
        {"event_date": v["administered_at"], "kind": "vaccine", "title": v["name"], "detail": {"dose_number": v.get("dose_number")}}
        for v in patient["vaccinations"]
    ]  # fmt: skip
    # relogio: amostras e alertas (o motor de regras roda como se hoje fosse AS_OF) + eventos 'alert' como na view
    samples = read_samples_csv(base / "wearables.csv")
    alerts = evaluate(samples, AS_OF)
    wearables = [{"t": x.t.isoformat(), "metric": x.metric, "value": x.value, "unit": x.unit} for x in samples]
    alerts_out = [
        {"kind": a.kind, "severity": a.severity, "title": a.title, "message": a.message,
         "triggered_at": a.triggered_at.isoformat(), "evidence": a.evidence}
        for a in alerts
    ]  # fmt: skip
    events += [
        {"event_date": a.triggered_at.date().isoformat(), "kind": "alert", "title": a.title,
         "detail": {"kind": a.kind, "severity": a.severity, "message": a.message, "alert_id": None}}
        for a in alerts
    ]  # fmt: skip
    events.sort(key=lambda e: (e["event_date"], e["kind"], e["title"]))

    return {
        "synthetic": True,
        "note": "DADOS 100% SINTETICOS (personagem ficticia). Gerado por scripts/build_demo_data.py; nao edite a mao.",
        "patient": {k: patient["patient"][k] for k in ("full_name", "birth_date", "sex")},
        "points": rows_out,
        "events": events,
        "wearables": wearables,
        "alerts": alerts_out,
    }


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = build()
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    kinds = Counter(e["kind"] for e in data["events"])
    print(f"ok: {len(data['points'])} leituras, {len(data['events'])} eventos {dict(kinds)} -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
