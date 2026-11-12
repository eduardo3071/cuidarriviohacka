from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.services.extraction.schemas import ExtractedObservation

MIN_DATE = date(1900, 1, 1)


class UploadResponse(BaseModel):
    document_id: UUID
    job_id: UUID
    status: str
    duplicate: bool = Field(description="True = o mesmo arquivo ja tinha sido enviado; nada novo a processar")


class JobOut(BaseModel):
    id: UUID
    document_id: UUID | None
    status: str  # queued | running | succeeded | failed
    error_code: str | None = None
    error: str | None = None
    created_at: datetime | None = None


class DocumentOut(BaseModel):
    id: UUID
    status: str  # uploaded | processing | pending_review | confirmed | failed
    mime_type: str
    lab_name: str | None = None
    collected_at: date | None = None
    extraction_method: str | None = None


class PageOut(BaseModel):
    page: int
    url: str = Field(description="URL temporaria da imagem da pagina (as bbox sao relativas a ela)")


class ReviewOut(BaseModel):
    document_id: UUID
    method: str
    lab_name: str | None = Field(description="Sugestao; o usuario confirma")
    collected_at: date | None = Field(description="Sugestao; o usuario confirma")
    warnings: list[str]
    observations: list[ExtractedObservation]
    pages: list[PageOut]


class ConfirmObservation(BaseModel):
    """Uma leitura JA REVISADA pelo usuario (pode ter sido editada). Validada aqui porque vai
    para o historico clinico: nada de NaN/infinito, faixa invertida ou caixa fora da pagina."""

    raw_name: str = Field(min_length=1, max_length=200)
    canonical_name: str | None = Field(default=None, max_length=120)
    value: float = Field(allow_inf_nan=False)
    unit: str | None = Field(default=None, max_length=30)
    ref_low: float | None = Field(default=None, allow_inf_nan=False)
    ref_high: float | None = Field(default=None, allow_inf_nan=False)
    ref_text: str | None = Field(default=None, max_length=60)
    confidence: float | None = Field(default=None, ge=0, le=1)
    page: int = Field(default=1, ge=1, le=50)
    bbox: tuple[float, float, float, float] | None = None
    method: Literal["text_layer", "ocr", "llm", "manual"] = "manual"
    notes: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("notes")
    @classmethod
    def _short_notes(cls, v: list[str]) -> list[str]:
        return [n[:300] for n in v]

    @field_validator("bbox")
    @classmethod
    def _bbox_inside_page(cls, v):
        if v is None:
            return v
        x0, y0, x1, y1 = v
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
            raise ValueError("bbox deve ser x0<x1 e y0<y1, normalizada entre 0 e 1")
        return v

    @model_validator(mode="after")
    def _range_order(self):
        if self.ref_low is not None and self.ref_high is not None and self.ref_low > self.ref_high:
            raise ValueError("ref_low maior que ref_high")
        return self


class ConfirmRequest(BaseModel):
    collected_at: date
    lab_name: str | None = Field(default=None, max_length=120)
    observations: list[ConfirmObservation] = Field(min_length=1, max_length=200)

    @field_validator("collected_at")
    @classmethod
    def _plausible_date(cls, v: date) -> date:
        if v < MIN_DATE or v > date.today():
            raise ValueError("data da coleta fora do intervalo plausivel (1900 ate hoje)")
        return v

    @field_validator("lab_name")
    @classmethod
    def _blank_is_none(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v else None


class ConfirmResponse(BaseModel):
    confirmed: int = Field(description="Leituras gravadas")
    submitted: int = Field(description="Leituras enviadas (as repetidas no mesmo documento sao ignoradas)")
    already: bool = Field(description="True = o documento ja estava confirmado; nada mudou")
