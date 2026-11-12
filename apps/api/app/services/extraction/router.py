"""Roteador de extracao: escolhe o caminho mais barato que funciona, do local para o hospedado.

PDF com texto:  texto + regra  ->  (nada reconhecido) OCR local  ->  IA hospedada
Foto/imagem:    OCR local      ->  (nada reconhecido) IA hospedada
Nada reconhecido em nenhum caminho disponivel: ExtractionError('no_results').

Cada saida diz COMO foi obtida (`method`) e traz as imagens das paginas de que as caixas
(`bbox`) dependem. A IA nao devolve posicao: suas leituras vem sem `bbox`.
"""
from dataclasses import dataclass, field

from app.services.llm.base import Image, LLMClient, LLMError
from app.services.normalization.ontology import Ontology

from . import dates, llm_extractor, ocr_extractor, pdf_words, preprocess
from .from_words import observations_from_words
from .schemas import ExtractedObservation

MIN_TEXT_CHARS = 40  # abaixo disso a "camada de texto" e lixo/vazia: trate a pagina como imagem
MAX_IMAGE_SIDE = 2000  # imagens guardadas/enviadas a IA: limita tamanho sem perder leitura


class ExtractionError(Exception):
    """Falha esperada, com codigo estavel para a API/UI e mensagem segura para mostrar."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class Capabilities:
    ontology: Ontology
    ocr_enabled: bool = False  # OCR local pesa (~400 MB, 10+ s/pagina): so onde o servidor aguenta
    llm: LLMClient | None = None
    ocr_engine: object | None = None


@dataclass
class ExtractionOutcome:
    observations: list[ExtractedObservation]
    lab_name: str | None
    collected_at: str | None  # ISO; sugestao a confirmar pelo usuario
    page_images: list[bytes]  # JPEG por pagina; as bbox sao relativas a ESTAS imagens
    method: str  # text_layer | ocr | llm
    warnings: list[str] = field(default_factory=list)


def extract_document(data: bytes, mime: str, caps: Capabilities) -> ExtractionOutcome:
    return _from_pdf(data, caps) if mime == "application/pdf" else _from_image(data, caps)


# ---------------------------------------------------------------- PDF
def _from_pdf(data: bytes, caps: Capabilities) -> ExtractionOutcome:
    try:
        pages = pdf_words.read_pdf(data)
    except Exception as e:  # noqa: BLE001  pdfplumber/pdfminer levantam varios tipos para PDF corrompido
        raise ExtractionError("invalid_pdf", "Nao foi possivel ler o PDF (corrompido ou protegido).") from e
    if not pages:
        raise ExtractionError("invalid_pdf", "O PDF nao tem paginas.")

    text_obs: list[ExtractedObservation] = []
    for pg in pages:
        obs, _ = observations_from_words(
            pg.words, pg.width, pg.height, caps.ontology, page=pg.number, method="text_layer", noisy=False
        )
        text_obs += obs
    texts = [pg.text for pg in pages]
    date = dates.find_collection_date("\n".join(texts))
    if text_obs:
        return ExtractionOutcome(text_obs, None, date, pdf_words.render_pages(data, fmt="jpeg"), "text_layer")

    # texto nao rendeu: o PDF pode ser escaneado, ou ter um layout que a regra nao entende
    pngs = pdf_words.render_pages(data, fmt="png", dpi=150)
    jpegs = pdf_words.render_pages(data, fmt="jpeg")
    return _fallbacks(pngs, jpegs, texts, date, caps)


# ---------------------------------------------------------------- imagem
def _from_image(data: bytes, caps: Capabilities) -> ExtractionOutcome:
    try:
        img = preprocess.decode(data)
    except ValueError as e:
        raise ExtractionError("invalid_image", "Nao foi possivel ler a imagem.") from e
    small = preprocess.resize_max(img, MAX_IMAGE_SIDE)
    return _fallbacks([data], [preprocess.encode_jpeg(small)], [], None, caps)


# ---------------------------------------------------------------- OCR e IA
def _fallbacks(
    images: list[bytes], display_jpegs: list[bytes], texts: list[str], date: str | None, caps: Capabilities
) -> ExtractionOutcome:
    if not caps.ocr_enabled and caps.llm is None:
        raise ExtractionError(
            "no_extractor",
            "Este servidor nao tem OCR nem IA configurados para ler imagens ou layouts desconhecidos.",
        )

    warnings: list[str] = []
    if caps.ocr_enabled:
        outcomes = [
            ocr_extractor.extract_page(img, caps.ontology, page=i, engine=caps.ocr_engine)
            for i, img in enumerate(images, start=1)
        ]
        obs = [o for p in outcomes for o in p.observations]
        if obs:
            ocr_text = "\n".join(ln.text for p in outcomes for ln in p.lines)
            return ExtractionOutcome(
                obs,
                None,
                date or dates.find_collection_date(ocr_text),
                [preprocess.encode_jpeg(p.page_image) for p in outcomes],  # a pagina plana: referencia das bbox
                "ocr",
            )
        warnings.append("OCR local nao reconheceu resultados.")

    if caps.llm is not None:
        try:
            if sum(len(t) for t in texts) >= MIN_TEXT_CHARS:
                out = llm_extractor.extract_texts(caps.llm, texts)
            else:
                out = llm_extractor.extract_images(caps.llm, [Image(j, "image/jpeg") for j in display_jpegs])
        except LLMError as e:
            raise ExtractionError("llm_failed", str(e)) from e
        obs = [_with_canonical(o, caps.ontology) for o in out.result.observations]
        if obs:
            return ExtractionOutcome(
                obs, out.result.lab_name, out.result.collected_at or date, display_jpegs, "llm", warnings
            )
        warnings.append("A IA nao encontrou resultados.")

    raise ExtractionError(
        "no_results",
        "Nenhum resultado de exame foi reconhecido neste arquivo. Tente uma foto mais nitida e reta, "
        "ou outro arquivo. " + " ".join(warnings),
    )


def _with_canonical(o: ExtractedObservation, ontology: Ontology) -> ExtractedObservation:
    bm = ontology.resolve(o.raw_name)
    return o.model_copy(update={"canonical_name": bm.canonical_name if bm else None})
