"""PDF (bytes) -> palavras com posicao da camada de texto + imagens das paginas."""
import io
from dataclasses import dataclass

import pdfplumber
import pymupdf

from .ocr import OcrWord

MAX_PAGES = 10


@dataclass
class PdfPage:
    number: int  # 1-based
    width: float  # pontos do PDF
    height: float
    words: list[OcrWord]  # score 1.0: texto digital nao tem incerteza de reconhecimento
    text: str


def read_pdf(data: bytes, max_pages: int = MAX_PAGES) -> list[PdfPage]:
    pages: list[PdfPage] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for i, page in enumerate(pdf.pages[:max_pages], start=1):
            words = [OcrWord(w["text"], 1.0, w["x0"], w["top"], w["x1"], w["bottom"]) for w in page.extract_words()]
            pages.append(PdfPage(i, float(page.width), float(page.height), words, (page.extract_text() or "").strip()))
    return pages


def render_pages(data: bytes, *, fmt: str, dpi: int = 130, max_pages: int = MAX_PAGES) -> list[bytes]:
    """Renderiza as paginas (fmt: 'png' ou 'jpeg'). A imagem tem a mesma proporcao do PDF, entao
    caixas normalizadas (x/largura, y/altura) do texto do PDF valem direto sobre ela."""
    doc = pymupdf.open(stream=data, filetype="pdf")
    return [page.get_pixmap(dpi=dpi).tobytes(fmt) for page in list(doc)[:max_pages]]
