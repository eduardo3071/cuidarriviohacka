from typing import Literal

from pydantic import BaseModel, Field


class ExtractedObservation(BaseModel):
    """Contrato entre o extrator (IA ou regras) e o resto do sistema.

    Um resultado lido de um laudo, ANTES de o paciente confirmar.
    """

    raw_name: str = Field(description="Nome do exame como lido do laudo (pode conter erro de OCR)")
    canonical_name: str | None = Field(
        default=None, description="Biomarcador da ontologia, se o extrator ja o resolveu"
    )
    value: float
    unit: str | None = Field(default=None, description="Unidade como lida do laudo (ou corrigida; ver notes)")
    ref_low: float | None = Field(default=None, description="Limite inferior da faixa DO LAUDO")
    ref_high: float | None = Field(default=None, description="Limite superior da faixa DO LAUDO")
    ref_text: str | None = Field(default=None, description="Faixa de referencia como impressa")
    page: int = 1
    bbox: tuple[float, float, float, float] | None = Field(
        default=None, description="x0,y0,x1,y1 normalizado 0..1 do VALOR na imagem da pagina (origem)"
    )
    confidence: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Confianca de RECONHECIMENTO do OCR, nao probabilidade de acerto clinico. "
        "None = o extrator nao estima (nao assumir 1.0)",
    )
    notes: list[str] = Field(
        default_factory=list, description="Correcoes automaticas aplicadas; a tela de revisao deve mostra-las"
    )
    method: Literal["text_layer", "ocr", "llm"] | None = Field(
        default=None, description="Como a leitura foi obtida (auditoria e filtro na revisao)"
    )


class ExtractionResult(BaseModel):
    lab_name: str | None = None
    collected_at: str | None = None  # ISO yyyy-mm-dd, se o laudo informar
    observations: list[ExtractedObservation]
