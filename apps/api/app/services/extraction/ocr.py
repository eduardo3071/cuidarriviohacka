"""OCR local (RapidOCR/ONNX, CPU) com caixa por palavra, e reconstrucao de linhas de tabela.

O OCR devolve palavras fora de ordem de leitura (colunas de uma tabela vem em
blocos). `group_lines` as reagrupa por linha visual, e `OcrLine.bbox_for_span`
liga um trecho do texto da linha (ex.: o valor numerico) a sua caixa na imagem.
"""
import logging
import re
from dataclasses import dataclass, field
from statistics import median

import numpy as np

logging.getLogger("RapidOCR").setLevel(logging.WARNING)

_ENGINE = None


def get_engine():
    """Motor unico por processo (importar/instanciar custa alguns segundos)."""
    global _ENGINE
    if _ENGINE is None:
        from rapidocr import RapidOCR

        _ENGINE = RapidOCR()
        logging.getLogger("RapidOCR").setLevel(logging.WARNING)
    return _ENGINE


@dataclass(frozen=True)
class OcrWord:
    text: str
    score: float  # confianca de RECONHECIMENTO do OCR (0..1), nao de acerto clinico
    x0: float
    y0: float
    x1: float
    y1: float  # pixels da imagem passada ao OCR

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def height(self) -> float:
        return self.y1 - self.y0


@dataclass
class OcrLine:
    words: list[OcrWord]
    text: str = ""
    spans: list[tuple[int, int]] = field(default_factory=list)  # (inicio, fim) de cada palavra em `text`

    def bbox_for_span(
        self, start: int, end: int, img_w: int, img_h: int, pad: float = 0.0
    ) -> tuple[float, float, float, float] | None:
        """Caixa normalizada (0..1) do trecho text[start:end]. Se o trecho e parte de uma palavra
        (ex.: '5,9' dentro de '5,9%'), interpola x pela proporcao de caracteres.
        `pad` = margem em fracao da altura da palavra (a caixa do OCR costuma ser justa)."""
        xs0, xs1, ys0, ys1 = [], [], [], []
        for w, (ws, we) in zip(self.words, self.spans):
            lo, hi = max(start, ws), min(end, we)
            if lo >= hi:
                continue
            n = we - ws
            xs0.append(w.x0 + (lo - ws) / n * (w.x1 - w.x0))
            xs1.append(w.x0 + (hi - ws) / n * (w.x1 - w.x0))
            ys0.append(w.y0)
            ys1.append(w.y1)
        if not xs0:
            return None
        m = pad * (max(ys1) - min(ys0))
        clip = lambda v: float(min(1.0, max(0.0, v)))  # noqa: E731
        return (
            clip((min(xs0) - m) / img_w),
            clip((min(ys0) - m / 2) / img_h),
            clip((max(xs1) + m) / img_w),
            clip((max(ys1) + m / 2) / img_h),
        )

    def min_score(self, start: int, end: int) -> float | None:
        s = [w.score for w, (ws, we) in zip(self.words, self.spans) if max(start, ws) < min(end, we)]
        return min(s) if s else None


def recognize(image_bgr: np.ndarray, engine=None) -> list[OcrWord]:
    out = (engine or get_engine())(image_bgr, return_word_box=True)
    words: list[OcrWord] = []
    for segment in out.word_results or ():
        for text, score, quad in segment:
            if not text.strip():
                continue
            xs = [p[0] for p in quad]
            ys = [p[1] for p in quad]
            words.append(OcrWord(text.strip(), float(score), min(xs), min(ys), max(xs), max(ys)))
    return drop_overlapping(words)


def _inside_fraction(a: OcrWord, b: OcrWord) -> float:
    """Fracao da area de `a` que fica dentro de `b`."""
    ix = max(0.0, min(a.x1, b.x1) - max(a.x0, b.x0))
    iy = max(0.0, min(a.y1, b.y1) - max(a.y0, b.y0))
    area = (a.x1 - a.x0) * (a.y1 - a.y0)
    return (ix * iy) / area if area > 0 else 0.0


def drop_overlapping(words: list[OcrWord], threshold: float = 0.7) -> list[OcrWord]:
    """Descarta palavra (curta) quase toda contida em outra maior: deteccao duplicada/fantasma
    (ex.: um '2' lido por cima de '162')."""
    keep = []
    for a in words:
        ghost = any(
            b is not a and len(b.text) > len(a.text) and _inside_fraction(a, b) >= threshold for b in words
        )
        if not ghost:
            keep.append(a)
    return keep


_NUM_END = re.compile(r"\d$")
_DEC_START = re.compile(r"^[.,]\d")


def merge_split_numbers(row: list[OcrWord]) -> list[OcrWord]:
    """Junta '0' + ',88' em '0,88' quando o OCR parte um numero no separador decimal.
    Feito no nivel das palavras para as caixas continuarem corretas. Linha ja ordenada por x."""
    merged: list[OcrWord] = []
    for w in row:
        p = merged[-1] if merged else None
        if p and _NUM_END.search(p.text) and _DEC_START.match(w.text) and (w.x0 - p.x1) < p.height:
            merged[-1] = OcrWord(
                p.text + w.text, min(p.score, w.score), p.x0, min(p.y0, w.y0), w.x1, max(p.y1, w.y1)
            )
        else:
            merged.append(w)
    return merged


def group_lines(words: list[OcrWord]) -> list[OcrLine]:
    """Agrupa palavras em linhas visuais (por centro vertical) e ordena cada linha da esquerda p/ direita."""
    if not words:
        return []
    tol = 0.6 * median(w.height for w in words)
    rows: list[list[OcrWord]] = []
    for w in sorted(words, key=lambda w: w.cy):
        if rows and abs(w.cy - median(r.cy for r in rows[-1])) <= tol:
            rows[-1].append(w)
        else:
            rows.append([w])
    lines = []
    for row in rows:
        row = merge_split_numbers(sorted(row, key=lambda w: w.x0))
        text, spans, pos = "", [], 0
        for i, w in enumerate(row):
            if i:
                text += " "
                pos += 1
            spans.append((pos, pos + len(w.text)))
            text += w.text
            pos += len(w.text)
        lines.append(OcrLine(words=row, text=text, spans=spans))
    return lines
