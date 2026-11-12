"""Series de exames comparaveis entre laboratorios (implementacao de REFERENCIA, em Decimal).

Cada leitura mantem o que o laudo disse (valor, unidade e faixa DO LAUDO) e ganha o valor na
unidade canonica do biomarcador. A bandeira (abaixo/na faixa/acima) e decidida pela faixa do
PROPRIO laudo, nos valores originais: o mesmo 101 mg/dL pode estar na faixa em um laboratorio e
acima em outro, e as duas coisas estao certas.

A view SQL `observation_series` implementa a MESMA regra; os dois sao conferidos entre si.
Aritmetica exata (Decimal) e arredondamento HALF_UP a 3 casas, como o numeric do Postgres.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from .convert import unit_key
from .ontology import Ontology

PLACES = Decimal("0.001")

Normalization = Literal["canonical", "converted", "unit_unknown", "unmapped"]
Flag = Literal["below", "in_range", "above", "no_range"]


def _dec(x) -> Decimal | None:
    if x is None or x == "":
        return None
    return Decimal(str(x))


def _round(x: Decimal | None) -> Decimal | None:
    return None if x is None else x.quantize(PLACES, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class SeriesPoint:
    biomarker: str | None  # nome canonico; None = nao reconhecido
    unit_canonical: str | None
    collected_at: date
    lab_name: str | None
    raw_name: str
    raw_value: Decimal
    raw_unit: str | None
    raw_ref_low: Decimal | None  # faixa DO LAUDO, como veio
    raw_ref_high: Decimal | None
    ref_text: str | None
    value: Decimal | None  # na unidade canonica (None se nao deu para normalizar)
    ref_low: Decimal | None  # faixa do laudo convertida para a unidade canonica
    ref_high: Decimal | None
    normalization: Normalization
    flag: Flag


def flag_for(value: Decimal, low: Decimal | None, high: Decimal | None) -> Flag:
    """Contra a faixa do proprio laudo. Limite exato conta como dentro ('< 130' com 130 esta dentro)."""
    if low is None and high is None:
        return "no_range"
    if high is not None and value > high:
        return "above"
    if low is not None and value < low:
        return "below"
    return "in_range"


def _transform(onto: Ontology, biomarker: str, unit: str | None):
    """(normalization, factor, offset) para levar `unit` a unidade canonica do biomarcador."""
    if not unit or not unit.strip():
        return "unit_unknown", None, None
    bm = onto.biomarkers[biomarker]
    if unit_key(unit) == unit_key(bm.unit_canonical):
        return "canonical", Decimal(1), Decimal(0)
    conv = next(
        (r for r in onto.conversion_rows if r["canonical_name"] == biomarker and unit_key(r["from_unit"]) == unit_key(unit)),
        None,
    )
    if conv is None:
        return "unit_unknown", None, None
    return "converted", Decimal(conv["factor"]), Decimal(conv["offset"])


def build_point(row: dict, onto: Ontology) -> SeriesPoint:
    """`row`: raw_name, value, unit, ref_low, ref_high, ref_text, collected_at (date ou ISO), lab_name,
    e opcionalmente canonical_name (leituras ja confirmadas)."""
    raw_value, low, high = _dec(row["value"]), _dec(row.get("ref_low")), _dec(row.get("ref_high"))
    when = row["collected_at"] if isinstance(row["collected_at"], date) else date.fromisoformat(row["collected_at"])
    name = row.get("canonical_name")
    if name is None:
        bm = onto.resolve(row["raw_name"])
        name = bm.canonical_name if bm else None

    if name is None:
        norm, factor, offset = "unmapped", None, None
    else:
        norm, factor, offset = _transform(onto, name, row.get("unit"))

    def conv(x: Decimal | None) -> Decimal | None:
        return None if x is None or factor is None else _round(x * factor + offset)

    return SeriesPoint(
        biomarker=name,
        unit_canonical=onto.biomarkers[name].unit_canonical if name else None,
        collected_at=when,
        lab_name=row.get("lab_name"),
        raw_name=row["raw_name"],
        raw_value=raw_value,
        raw_unit=row.get("unit"),
        raw_ref_low=low,
        raw_ref_high=high,
        ref_text=row.get("ref_text"),
        value=conv(raw_value),
        ref_low=conv(low),
        ref_high=conv(high),
        normalization=norm,
        flag=flag_for(raw_value, low, high),
    )


def build_points(rows: list[dict], onto: Ontology) -> list[SeriesPoint]:
    return [build_point(r, onto) for r in rows]


def _fmt3(x: Decimal | None) -> str:
    return "" if x is None else f"{x:.3f}"


def reference_digest(points: list[SeriesPoint]) -> str:
    """MD5 do conteudo normalizado, no MESMO formato que a view SQL `observation_series` produz
    (ver supabase/migrations/..._series_and_timeline_views.sql). Se SQL e Python concordam no hash,
    concordam em cada valor, faixa convertida, normalizacao e bandeira."""
    import hashlib

    keyed = sorted(
        (
            (p.biomarker or "", p.collected_at.isoformat(), p.raw_name),
            f"{p.biomarker}|{p.collected_at.isoformat()}|{p.raw_name}|{_fmt3(p.value)}|{_fmt3(p.ref_low)}|"
            f"{_fmt3(p.ref_high)}|{p.normalization}|{p.flag}",
        )
        for p in points
    )  # ordem = (biomarcador, data, nome): codepoint, igual ao collate "C" do SQL
    return hashlib.md5("\n".join(line for _, line in keyed).encode("utf-8")).hexdigest()


def group_by_biomarker(points: list[SeriesPoint]) -> dict[str, list[SeriesPoint]]:
    """So pontos normalizaveis, por biomarcador, em ordem de data (a serie que o grafico desenha)."""
    out: dict[str, list[SeriesPoint]] = defaultdict(list)
    for p in points:
        if p.biomarker and p.value is not None:
            out[p.biomarker].append(p)
    return {k: sorted(v, key=lambda p: p.collected_at) for k, v in sorted(out.items())}
