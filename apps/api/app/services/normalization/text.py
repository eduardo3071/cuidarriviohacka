import re
import unicodedata


def normalize_alias(name: str) -> str:
    """Forma canonica de um nome de exame para busca em biomarker_aliases.

    minusculo, sem acento, so [a-z0-9] separados por um espaco.
    "Hemoglobina glicada (HbA1c)" -> "hemoglobina glicada hba1c"
    A MESMA regra e usada ao gerar o seed e ao normalizar a extracao.
    """
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", ascii_only.lower()).strip()
