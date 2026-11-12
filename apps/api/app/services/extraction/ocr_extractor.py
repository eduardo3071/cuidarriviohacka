"""Extracao local de foto/escaneado: pre-processa -> OCR com caixas -> regex de linha -> bbox de origem.

Cada leitura sai com `bbox` (caixa do VALOR na imagem devolvida em `page_image`)
e `confidence` = menor confianca de reconhecimento das palavras do trecho valor+unidade.
"""
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pymupdf

from app.services.normalization.ontology import Ontology

from . import ocr, preprocess
from .from_words import BBOX_PAD, observations_from_words  # noqa: F401  (BBOX_PAD reexportado)
from .schemas import ExtractedObservation


@dataclass
class PageOutcome:
    observations: list[ExtractedObservation]
    page_image: np.ndarray  # a pagina plana: referencia das bbox
    lines: list[ocr.OcrLine] = field(default_factory=list)
    page_found: bool = False
    flattened: bool = False
    skew_deg: float = 0.0
    seconds: float = 0.0


def extract_page(
    data: bytes | np.ndarray,
    ontology: Ontology,
    *,
    page: int = 1,
    engine=None,
    flatten: bool | None = None,
) -> PageOutcome:
    t0 = time.perf_counter()
    prep = preprocess.prepare_page(data, flatten=flatten)
    h, w = prep.image.shape[:2]
    words = ocr.recognize(prep.ocr_image, engine)
    observations, lines = observations_from_words(words, w, h, ontology, page=page, method="ocr", noisy=True)
    return PageOutcome(
        observations,
        prep.image,
        lines,
        page_found=prep.page_found,
        flattened=prep.flattened,
        skew_deg=prep.skew_deg,
        seconds=time.perf_counter() - t0,
    )


def render_pdf_pages(pdf_path: Path, dpi: int = 150, max_pages: int = 10) -> list[bytes]:
    doc = pymupdf.open(str(pdf_path))
    return [page.get_pixmap(dpi=dpi).tobytes("png") for page in list(doc)[:max_pages]]


def extract_pdf_as_scan(pdf_path: Path, ontology: Ontology, *, engine=None) -> list[PageOutcome]:
    """PDF escaneado (sem camada de texto confiavel): cada pagina vira imagem e passa pelo OCR."""
    return [extract_page(png, ontology, page=i, engine=engine) for i, png in enumerate(render_pdf_pages(pdf_path), 1)]
