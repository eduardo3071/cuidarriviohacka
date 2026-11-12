"""Extrator BASE, sem IA: texto (camada do PDF ou OCR) + regex de linha unica, filtrado pela ontologia.

Serve de linha de base para medir o que a IA precisa resolver. Entende apenas
linhas do tipo "<exame> <valor><unidade> [flag] <faixa>". Layouts em que o
resultado fica em outra linha (ex.: "Resultado: ...") NAO sao tratados de
proposito: e onde um LLM precisa entrar.
"""
import re
from dataclasses import dataclass
from pathlib import Path

import pdfplumber

from app.services.normalization.ontology import Ontology

from .schemas import ExtractedObservation

_NUM = r"\d+(?:[.,]\d+)?"
# o valor tem de vir precedido de espaco (evita pegar o '25' de 'Vitamina D (25-OH)');
# a unidade pode vir colada ao valor ('5,9%') porque o OCR junta os dois
_LINE = re.compile(
    rf"^(?P<name>.+?)\s+(?P<value>{_NUM})\s*(?P<unit>[^\s\d(<>=][^\s]*)\s*(?P<rest>.*)$"
)


def to_float(s: str) -> float:
    return float(s.replace(",", "."))


def parse_ref(text: str) -> tuple[float | None, float | None, str | None]:
    """'< 130' -> (None, 130); '> 50' -> (50, None); '70 - 99' / '(70 a 99)' -> (70, 99)."""
    t = text.strip()
    t = re.sub(r"^[HL*]\s+", "", t)  # flag H/L antes da faixa
    t = re.sub(r"(?i)^(valor de refer[eê]ncia|refer[eê]ncia|ref\.?)\s*:?\s*", "", t)
    t = t.strip("() ")
    if not t:
        return None, None, None
    m = re.match(rf"^<\s*=?\s*({_NUM})", t)
    if m:
        return None, to_float(m.group(1)), text.strip()
    m = re.match(rf"^>\s*=?\s*({_NUM})", t)
    if m:
        return to_float(m.group(1)), None, text.strip()
    m = re.match(rf"^({_NUM})\s*(?:-|a|to|–)\s*({_NUM})", t)
    if m:
        return to_float(m.group(1)), to_float(m.group(2)), text.strip()
    return None, None, text.strip()


@dataclass
class ParsedLine:
    """Uma linha de resultado reconhecida, com a posicao de cada trecho dentro do texto da linha."""

    observation: ExtractedObservation
    name_span: tuple[int, int]
    value_span: tuple[int, int]
    unit_span: tuple[int, int]


def parse_result_line(
    line: str, ontology: Ontology, page: int = 1, *, fuzzy: bool = False
) -> ParsedLine | None:
    """`fuzzy=True` (so para texto vindo de OCR) tolera erro de leitura no NOME do exame,
    com a correcao registrada em `notes` e a confianca limitada a similaridade."""
    m = _LINE.match(line)
    if not m:
        return None
    raw_name = m.group("name").strip()
    notes: list[str] = []
    cap: float | None = None
    bm = ontology.resolve(raw_name)
    if bm is None and fuzzy:
        hit = ontology.resolve_fuzzy(raw_name)
        if hit:
            bm, cap = hit
            notes.append(f"nome '{raw_name}' reconhecido por similaridade como '{bm.canonical_name}' ({cap:.2f})")
    if bm is None:
        return None
    lo, hi, txt = parse_ref(m.group("rest"))
    obs = ExtractedObservation(
        raw_name=raw_name,
        canonical_name=bm.canonical_name,
        value=to_float(m.group("value")),
        unit=m.group("unit"),
        ref_low=lo,
        ref_high=hi,
        ref_text=txt,
        page=page,
        confidence=cap,
        notes=notes,
    )
    return ParsedLine(obs, m.span("name"), m.span("value"), m.span("unit"))


def extract_lines(pdf_path: Path) -> list[tuple[int, str]]:
    lines: list[tuple[int, str]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            for ln in (page.extract_text() or "").splitlines():
                if ln.strip():
                    lines.append((i, ln.strip()))
    return lines


def page_texts(pdf_path: Path) -> list[str]:
    """Texto da camada de texto, uma string por pagina (vazia se a pagina e imagem)."""
    with pdfplumber.open(pdf_path) as pdf:
        return [(p.extract_text() or "").strip() for p in pdf.pages]


def extract_observations(pdf_path: Path, ontology: Ontology) -> list[ExtractedObservation]:
    out: list[ExtractedObservation] = []
    for page, line in extract_lines(pdf_path):
        parsed = parse_result_line(line, ontology, page)
        if parsed:
            out.append(parsed.observation)
    return out
