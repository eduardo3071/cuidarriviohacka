"""Gera o SQL do seed a partir dos CSV/JSON em data/.

    python scripts/build_seed.py

Saida (idempotente, pode reaplicar):
    supabase/seed/01_ontology.sql   biomarcadores, aliases, conversoes
    supabase/seed/02_marta.sql      paciente sintetica Marta + medico + historico
"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.services.normalization.ontology import load_ontology  # noqa: E402
from app.services.normalization.text import normalize_alias  # noqa: E402

DATA = ROOT / "data"
OUT = ROOT / "supabase" / "seed"


def q(v) -> str:
    """Literal SQL: None -> null, numero/str(numerica) -> como esta, texto -> aspas escapadas."""
    if v is None or v == "":
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def num(v) -> str:
    """Literal numerico a partir de string de CSV (valida que e numero)."""
    if v is None or v == "":
        return "null"
    float(v)
    return str(v)


def values(rows: list[list[str]]) -> str:
    return ",\n".join("  (" + ", ".join(r) + ")" for r in rows)


def build_ontology_sql(onto) -> str:
    bm_rows = [[q(b.canonical_name), q(b.category), q(b.unit_canonical)] for b in onto.biomarkers.values()]
    alias_rows = [
        [q(alias), q(name)] for alias, name in sorted(onto.alias_to_name.items())
    ]
    conv_rows = [
        [q(r["canonical_name"]), q(r["from_unit"]), q(r["to_unit"]), num(r["factor"]), num(r["offset"])]
        for r in onto.conversion_rows
    ]
    return f"""-- GERADO por scripts/build_seed.py a partir de data/ontology/*.csv. Nao edite a mao.
insert into public.biomarkers (canonical_name, category, unit_canonical) values
{values(bm_rows)}
on conflict (canonical_name) do update
  set category = excluded.category, unit_canonical = excluded.unit_canonical;

insert into public.biomarker_aliases (alias_normalized, biomarker_id)
select v.alias, b.id
from (values
{values(alias_rows)}
) as v(alias, canon)
join public.biomarkers b on b.canonical_name = v.canon
on conflict (alias_normalized) do update set biomarker_id = excluded.biomarker_id;

insert into public.unit_conversions (biomarker_id, from_unit, to_unit, factor, "offset")
select b.id, v.from_unit, v.to_unit, v.factor::numeric, v.off::numeric
from (values
{values(conv_rows)}
) as v(canon, from_unit, to_unit, factor, off)
join public.biomarkers b on b.canonical_name = v.canon
on conflict (biomarker_id, from_unit, to_unit) do update
  set factor = excluded.factor, "offset" = excluded."offset";
"""


def build_marta_sql(onto) -> str:
    base = DATA / "synthetic" / "marta"
    p = json.loads((base / "patient.json").read_text(encoding="utf-8"))
    with open(base / "observations.csv", encoding="utf-8", newline="") as f:
        obs = list(csv.DictReader(f))

    unresolved = {o["raw_name"] for o in obs if onto.resolve(o["raw_name"]) is None}
    if unresolved:
        raise SystemExit(f"nomes de exame sem alias na ontologia: {sorted(unresolved)}")

    pid, did = p["patient"]["id"], p["doctor"]["id"]
    pat, doc = p["patient"], p["doctor"]

    enc = [[q(pid) + "::uuid", q(e["occurred_at"]), q(e["specialty"]), q(e["provider"]), q(e["notes"])] for e in p["encounters"]]
    med = [[q(pid) + "::uuid", q(m["name"]), q(m["dose"]), q(m["started_at"]), q(m["ended_at"])] for m in p["medications"]]
    vac = [[q(pid) + "::uuid", q(v["name"]), q(v["dose_number"]), q(v["administered_at"])] for v in p["vaccinations"]]
    ob = [
        [
            q(normalize_alias(o["raw_name"])),
            q(o["raw_name"]),
            num(o["value"]),
            q(o["unit"]),
            num(o["ref_low"]),
            num(o["ref_high"]),
            q(o["ref_text"]),
            q(o["collected_at"]),
            q(o["lab_name"]),
        ]
        for o in obs
    ]

    return f"""-- GERADO por scripts/build_seed.py. DADOS 100% SINTETICOS (personagem ficticia).
-- Reaplicavel: apaga e recria a paciente Marta (cascade limpa o historico dela).
delete from public.patients where id = {q(pid)}::uuid;
delete from public.doctors  where id = {q(did)}::uuid;

insert into public.patients (id, full_name, birth_date, sex)
values ({q(pid)}::uuid, {q(pat["full_name"])}, {q(pat["birth_date"])}::date, {q(pat["sex"])});

insert into public.doctors (id, full_name, crm)
values ({q(did)}::uuid, {q(doc["full_name"])}, {q(doc["crm"])});

insert into public.encounters (patient_id, occurred_at, specialty, provider, notes)
select v.pid, v.d::date, v.specialty, v.provider, v.notes
from (values
{values(enc)}
) as v(pid, d, specialty, provider, notes);

insert into public.medications (patient_id, name, dose, started_at, ended_at)
select v.pid, v.name, v.dose, v.s::date, v.e::date
from (values
{values(med)}
) as v(pid, name, dose, s, e);

insert into public.vaccinations (patient_id, name, dose_number, administered_at)
select v.pid, v.name, v.n::int, v.d::date
from (values
{values(vac)}
) as v(pid, name, n, d);

-- observacoes: biomarker_id resolvido pelo alias normalizado (o mesmo caminho da extracao)
insert into public.observations
  (patient_id, biomarker_id, raw_name, value, unit, ref_low, ref_high, ref_text, collected_at, lab_name, status)
select {q(pid)}::uuid, a.biomarker_id, v.raw_name, v.value::numeric, v.unit,
       v.ref_low::numeric, v.ref_high::numeric, v.ref_text, v.collected_at::date, v.lab_name, 'confirmed'
from (values
{values(ob)}
) as v(norm, raw_name, value, unit, ref_low, ref_high, ref_text, collected_at, lab_name)
left join public.biomarker_aliases a on a.alias_normalized = v.norm;
"""


def main() -> None:
    onto = load_ontology(DATA / "ontology")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "01_ontology.sql").write_text(build_ontology_sql(onto), encoding="utf-8")
    (OUT / "02_marta.sql").write_text(build_marta_sql(onto), encoding="utf-8")
    print(f"ok: {len(onto.biomarkers)} biomarcadores, {len(onto.alias_to_name)} aliases, {len(onto.conversion_rows)} conversoes")


if __name__ == "__main__":
    main()
