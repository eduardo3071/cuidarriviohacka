import csv
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from functools import cached_property
from pathlib import Path

from .convert import Conversion, unit_key
from .text import normalize_alias


@dataclass
class Biomarker:
    canonical_name: str
    category: str
    unit_canonical: str
    aliases: set[str] = field(default_factory=set)  # normalizados, inclui o proprio nome


@dataclass
class Ontology:
    biomarkers: dict[str, Biomarker]
    alias_to_name: dict[str, str]
    # canonical_name -> unit_key(origem) -> Conversion
    conversions: dict[str, dict[str, Conversion]]
    conversion_rows: list[dict]

    def resolve(self, raw_name: str) -> Biomarker | None:
        name = self.alias_to_name.get(normalize_alias(raw_name))
        return self.biomarkers[name] if name else None

    def resolve_fuzzy(
        self, raw_name: str, min_ratio: float = 0.88, margin: float = 0.10, min_len: int = 8
    ) -> tuple[Biomarker, float] | None:
        """Resolve nome com erro de OCR por similaridade (ex.: 'hba1c' lido como 'hbatc').

        Conservador (dado de saude): so nomes longos (aliases curtos como TSH/ALT/HB exigem
        match exato), similaridade alta e MARGEM de 0.10 sobre o segundo biomarcador mais
        parecido. Pares que diferem por uma letra (LDL x HDL) ficam sem margem suficiente:
        devolve None e a leitura vai para revisao em vez de virar o exame errado.
        """
        n = normalize_alias(raw_name)
        if len(n) < min_len:
            return None
        best_per_marker: dict[str, float] = {}
        for alias, name in self.alias_to_name.items():
            if len(alias) < min_len:
                continue
            r = SequenceMatcher(None, n, alias).ratio()
            if r > best_per_marker.get(name, 0.0):
                best_per_marker[name] = r
        ranked = sorted(best_per_marker.items(), key=lambda kv: kv[1], reverse=True)
        if not ranked or ranked[0][1] < min_ratio:
            return None
        if len(ranked) > 1 and ranked[0][1] - ranked[1][1] < margin:
            return None
        return self.biomarkers[ranked[0][0]], ranked[0][1]

    def repair_unit(self, unit: str | None) -> tuple[str | None, bool]:
        """Corrige confusoes tipicas de OCR em unidades (mu grego, 'l' no lugar de 'I', ...).

        So troca por uma unidade JA CONHECIDA da ontologia e sem ambiguidade; senao devolve
        a unidade como veio. Retorna (unidade, foi_corrigida).
        """
        if not unit:
            return unit, False
        if unit_key(unit) in self._known_exact:
            return unit, False
        candidates = self._known_folded.get(_unit_fold(unit))
        if candidates and len(candidates) == 1:
            return next(iter(candidates)), True
        return unit, False

    @cached_property
    def _known_units(self) -> set[str]:
        units = {b.unit_canonical for b in self.biomarkers.values()}
        units |= {r["from_unit"].strip() for r in self.conversion_rows}
        return units

    @cached_property
    def _known_exact(self) -> set[str]:
        return {unit_key(u) for u in self._known_units}

    @cached_property
    def _known_folded(self) -> dict[str, set[str]]:
        folded: dict[str, set[str]] = {}
        for u in sorted(self._known_units):
            folded.setdefault(_unit_fold(u), set()).add(u)
        return folded


def _unit_fold(unit: str) -> str:
    """Chave que ignora as confusoes de OCR mais comuns: mu->u, e i/l/1/| tratados como um so."""
    return unit_key(unit).replace("µ", "u").translate(str.maketrans({"i": "l", "1": "l", "|": "l"}))


def load_ontology(ontology_dir: Path) -> Ontology:
    biomarkers: dict[str, Biomarker] = {}
    alias_to_name: dict[str, str] = {}

    with open(ontology_dir / "biomarkers.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            name = row["canonical_name"].strip()
            bm = Biomarker(name, row["category"].strip(), row["unit_canonical"].strip())
            raw_aliases = [name] + [a for a in row["aliases"].split("|") if a.strip()]
            for raw in raw_aliases:
                alias = normalize_alias(raw)
                owner = alias_to_name.get(alias)
                if owner and owner != name:
                    raise ValueError(f"alias {alias!r} colide: {owner!r} x {name!r}")
                alias_to_name[alias] = name
                bm.aliases.add(alias)
            if name in biomarkers:
                raise ValueError(f"biomarcador duplicado: {name!r}")
            biomarkers[name] = bm

    conversions: dict[str, dict[str, Conversion]] = {}
    rows: list[dict] = []
    with open(ontology_dir / "unit_conversions.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            name = row["canonical_name"].strip()
            bm = biomarkers.get(name)
            if bm is None:
                raise ValueError(f"conversao para biomarcador inexistente: {name!r}")
            if unit_key(row["to_unit"]) != unit_key(bm.unit_canonical):
                raise ValueError(f"{name}: conversao deve terminar na unidade canonica {bm.unit_canonical!r}")
            conv = Conversion(float(row["factor"]), float(row["offset"]))
            conversions.setdefault(name, {})[unit_key(row["from_unit"])] = conv
            rows.append(row)

    return Ontology(biomarkers, alias_to_name, conversions, rows)
