"""Rotas de DEMONSTRACAO: leem um laudo e normalizam as leituras, sem login, sem banco e sem storage.

Servem a tela de demonstracao do front (modo "Ver demonstracao"), onde nao ha conta: o envio de laudo roda a extracao
REAL (texto do PDF e OCR/OpenCV em Python), mas nada e gravado em lugar nenhum. As leituras confirmadas ficam so na
memoria do navegador.

Seguranca: sao rotas ABERTAS, entao
  - ficam DESLIGADAS por padrao (DEMO_EXTRACT_ENABLED=false responde 404, como se a rota nao existisse);
  - tem limite de uso por IP;
  - nunca chamam a IA hospedada (so texto do PDF e OCR local), para nao gerar custo;
  - respeitam o mesmo limite de tamanho e a mesma checagem de tipo (pelo conteudo) do envio normal.
"""
import base64
import logging
import threading
import time
from collections import defaultdict, deque
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.core.config import Settings
from app.services.extraction.router import Capabilities, ExtractionError, extract_document
from app.services.normalization.ontology import load_ontology
from app.services.normalization.series import build_points

from .documents import sniff_type
from .errors import api_error
from .schemas import ConfirmRequest, PageOut, ReviewOut

router = APIRouter(prefix="/demo", tags=["demo"])
log = logging.getLogger("rivio.demo")

MAX_PAGES = 8  # paginas devolvidas na previa (cada uma e um JPEG em base64)
_build_lock = threading.Lock()


class RateLimiter:
    """Janela deslizante de 60 s por chave. Em memoria: serve a uma maquina local, nao a um cluster."""

    def __init__(self, per_minute: int) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        t = time.monotonic() if now is None else now
        with self._lock:
            q = self._hits[key]
            while q and t - q[0] >= 60:
                q.popleft()
            if len(q) >= self.per_minute:
                return False
            q.append(t)
            return True


def demo_settings(request: Request) -> Settings:
    s: Settings = request.app.state.settings
    if not s.demo_extract_enabled:
        raise HTTPException(status_code=404, detail="Not Found")  # igual a uma rota que nao existe
    return s


def demo_caps(request: Request, s: Settings = Depends(demo_settings)) -> Capabilities:
    """Ontologia + OCR local. Sem IA hospedada (llm=None) de proposito. O motor do OCR e unico e fica em memoria."""
    caps = getattr(request.app.state, "demo_caps", None)
    if caps is None:
        with _build_lock:
            caps = getattr(request.app.state, "demo_caps", None)
            if caps is None:
                caps = Capabilities(load_ontology(Path(s.ontology_dir)), ocr_enabled=s.ocr_enabled, llm=None)
                request.app.state.demo_caps = caps
    return caps


def _limit(request: Request, s: Settings) -> None:
    limiter = getattr(request.app.state, "demo_limiter", None)
    if limiter is None:
        with _build_lock:
            limiter = getattr(request.app.state, "demo_limiter", None)
            if limiter is None:
                limiter = request.app.state.demo_limiter = RateLimiter(s.demo_rate_per_minute)
    who = request.client.host if request.client else "?"
    if not limiter.allow(who):
        raise api_error(429, "rate_limited", "Muitas leituras em pouco tempo. Aguarde um minuto e tente de novo.")


def _parse_iso(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None  # a data e so uma sugestao: a pessoa confirma na revisao


@router.post("/extract", response_model=ReviewOut)
def demo_extract(
    request: Request,
    file: UploadFile = File(...),
    s: Settings = Depends(demo_settings),
    caps: Capabilities = Depends(demo_caps),
) -> ReviewOut:
    """Le o laudo (PDF com texto, ou foto por OCR) e devolve o que foi lido, no mesmo formato da revisao do envio normal."""
    _limit(request, s)
    max_bytes = s.max_upload_mb * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise api_error(413, "file_too_large", f"O arquivo passa de {s.max_upload_mb} MB.")
    if not data:
        raise api_error(422, "empty_file", "O arquivo esta vazio.")
    kind = sniff_type(data)
    if kind is None:
        raise api_error(415, "unsupported_type", "Envie um PDF, JPEG, PNG ou WebP.")
    mime, _ext = kind
    try:
        out = extract_document(data, mime, caps)
    except ExtractionError as e:
        raise api_error(422, e.code, e.message) from e
    except Exception as e:  # noqa: BLE001  detalhe so no log; a tela recebe uma mensagem segura
        log.exception("falha na leitura de demonstracao")
        raise api_error(500, "internal_error", "Falha interna ao ler o documento. Tente novamente.") from e

    shown = out.page_images[:MAX_PAGES]
    warnings = list(out.warnings)
    if len(out.page_images) > MAX_PAGES:
        warnings.append(f"Só as primeiras {MAX_PAGES} páginas aparecem na prévia.")
    return ReviewOut(
        document_id=uuid4(),
        method=out.method,
        lab_name=out.lab_name,
        collected_at=_parse_iso(out.collected_at),
        warnings=warnings,
        observations=out.observations,
        pages=[PageOut(page=i, url="data:image/jpeg;base64," + base64.b64encode(jpeg).decode("ascii")) for i, jpeg in enumerate(shown, start=1)],
    )


class NormalizedPoint(BaseModel):
    """Mesmas colunas da view `observation_series` (e de SeriesPoint no front)."""

    biomarker: str | None
    category: str | None
    unit_canonical: str | None
    collected_at: date
    lab_name: str | None
    raw_name: str
    raw_value: float
    raw_unit: str | None
    raw_ref_low: float | None
    raw_ref_high: float | None
    ref_text: str | None
    normalization: str
    value: float | None
    ref_low: float | None
    ref_high: float | None
    flag: str


class NormalizeResponse(BaseModel):
    confirmed: int
    submitted: int
    points: list[NormalizedPoint]


def _f(x) -> float | None:
    return None if x is None else float(x)


@router.post("/normalize", response_model=NormalizeResponse)
def demo_normalize(
    body: ConfirmRequest,
    request: Request,
    s: Settings = Depends(demo_settings),
    caps: Capabilities = Depends(demo_caps),
) -> NormalizeResponse:
    """Normaliza as leituras JA REVISADAS (unidade canonica e bandeira pela faixa do proprio laudo) com a mesma regra
    de referencia do banco (`series.build_point`). Nao grava nada: a tela de demonstracao guarda o resultado na memoria."""
    _limit(request, s)
    onto = caps.ontology
    rows = []
    for o in body.observations:
        if o.canonical_name is not None and o.canonical_name not in onto.biomarkers:
            raise api_error(422, "unknown_biomarker", f"Biomarcador desconhecido: {o.canonical_name!r}.")
        rows.append(
            {
                "raw_name": o.raw_name, "canonical_name": o.canonical_name, "value": o.value, "unit": o.unit,
                "ref_low": o.ref_low, "ref_high": o.ref_high, "ref_text": o.ref_text,
                "collected_at": body.collected_at, "lab_name": body.lab_name,
            }
        )  # fmt: skip
    points = [
        NormalizedPoint(
            biomarker=p.biomarker,
            category=onto.biomarkers[p.biomarker].category if p.biomarker else None,
            unit_canonical=p.unit_canonical,
            collected_at=p.collected_at,
            lab_name=p.lab_name,
            raw_name=p.raw_name,
            raw_value=float(p.raw_value),
            raw_unit=p.raw_unit,
            raw_ref_low=_f(p.raw_ref_low),
            raw_ref_high=_f(p.raw_ref_high),
            ref_text=p.ref_text,
            normalization=p.normalization,
            value=_f(p.value),
            ref_low=_f(p.ref_low),
            ref_high=_f(p.ref_high),
            flag=p.flag,
        )
        for p in build_points(rows, onto)
    ]
    return NormalizeResponse(confirmed=len(points), submitted=len(body.observations), points=points)
