"""Mede o acerto de uma extracao contra o gabarito (a metrica que vira slide)."""
from dataclasses import dataclass, field

from app.services.normalization.convert import unit_key
from app.services.normalization.ontology import Ontology

from .schemas import ExtractedObservation


@dataclass
class Score:
    total: int = 0
    correct: int = 0          # exame + valor + unidade corretos
    ref_correct: int = 0      # entre os corretos, faixa do laudo tambem correta
    wrong: list[str] = field(default_factory=list)    # achou o exame, valor/unidade errado
    missing: list[str] = field(default_factory=list)  # exame do gabarito que nao saiu
    extra: list[str] = field(default_factory=list)    # saiu algo que nao esta no gabarito

    @property
    def accuracy(self) -> float:
        return self.correct / self.total if self.total else 0.0


def _same(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) < 1e-9


def score(truth: list[dict], extracted: list[ExtractedObservation], onto: Ontology) -> Score:
    s = Score(total=len(truth))
    pool = list(extracted)

    def canon(name: str) -> str:
        bm = onto.resolve(name)
        return bm.canonical_name if bm else f"?{name}"

    def canon_obs(e: ExtractedObservation) -> str:
        # o extrator pode ja ter resolvido o nome (OCR com correcao); senao resolve pelo texto lido
        return e.canonical_name or canon(e.raw_name)

    for t in truth:
        tc = canon(t["raw_name"])
        match = next((e for e in pool if canon_obs(e) == tc), None)
        if match is None:
            s.missing.append(t["raw_name"])
            continue
        pool.remove(match)
        if _same(match.value, t["value"]) and unit_key(match.unit) == unit_key(t["unit"]):
            s.correct += 1
            if _same(match.ref_low, t["ref_low"]) and _same(match.ref_high, t["ref_high"]):
                s.ref_correct += 1
        else:
            s.wrong.append(f'{t["raw_name"]}: esperado {t["value"]} {t["unit"]}, veio {match.value} {match.unit}')
    s.extra = [f"{e.raw_name} = {e.value} {e.unit}" for e in pool]
    return s
