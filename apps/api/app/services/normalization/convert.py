from dataclasses import dataclass


@dataclass(frozen=True)
class Conversion:
    factor: float
    offset: float = 0.0


def unit_key(unit: str | None) -> str:
    """Chave de comparacao de unidades: minusculo, sem espacos nas pontas,
    e o 'mu' grego (U+03BC) tratado como o sinal de micro (U+00B5)."""
    return (unit or "").strip().lower().replace("μ", "µ")


def to_canonical(
    value: float,
    unit: str | None,
    canonical_unit: str,
    conversions: dict[str, Conversion],
) -> float | None:
    """Converte para a unidade canonica: canonico = valor * factor + offset.

    `conversions` e indexado por unit_key(unidade de origem).
    Devolve None se a unidade nao e a canonica e nao ha conversao conhecida:
    quem chama deve marcar a leitura para revisao em vez de chutar.
    """
    if unit_key(unit) == unit_key(canonical_unit):
        return value
    conv = conversions.get(unit_key(unit))
    if conv is None:
        return None
    return value * conv.factor + conv.offset
