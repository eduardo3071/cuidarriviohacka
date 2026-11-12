from datetime import date, datetime
from typing import Protocol
from uuid import UUID

from pydantic import BaseModel


class DocumentNotFound(Exception):
    """Documento/job inexistente OU de outro dono (indistinguiveis de proposito: nao vaza existencia)."""


class DocumentNotReviewable(Exception):
    def __init__(self, status: str) -> None:
        super().__init__(f"documento em estado '{status}' nao pode ser confirmado")
        self.status = status


class NoObservations(Exception):
    pass


class DocumentRecord(BaseModel):
    id: UUID
    patient_id: UUID
    storage_path: str
    sha256: str
    mime_type: str
    status: str  # uploaded | processing | pending_review | confirmed | failed
    lab_name: str | None = None
    collected_at: date | None = None
    extraction_method: str | None = None
    page_paths: list[str] = []


class JobRecord(BaseModel):
    id: UUID
    patient_id: UUID
    document_id: UUID | None
    status: str  # queued | running | succeeded | failed
    error_code: str | None = None
    error: str | None = None
    result: dict | None = None
    created_at: datetime | None = None


class CreateOnceResult(BaseModel):
    document_id: UUID
    job_id: UUID
    is_new: bool  # False = o mesmo arquivo ja existia (nada a processar)
    status: str


class DocumentRepository(Protocol):
    """Acesso a dados do pipeline de documentos. As consultas "de dono" (patient_id) so enxergam
    linhas do paciente informado; os metodos `*_internal` sao do worker (ja autorizado)."""

    def get_patient_id_for_user(self, user_id: UUID) -> UUID | None: ...

    def create_document_once(self, patient_id: UUID, storage_path: str, sha256: str, mime: str) -> CreateOnceResult: ...

    def get_document(self, patient_id: UUID, document_id: UUID) -> DocumentRecord | None: ...

    def get_job(self, patient_id: UUID, job_id: UUID) -> JobRecord | None: ...

    def get_latest_job(self, patient_id: UUID, document_id: UUID) -> JobRecord | None: ...

    # --- worker
    def get_job_internal(self, job_id: UUID) -> JobRecord | None: ...

    def get_document_internal(self, document_id: UUID) -> DocumentRecord | None: ...

    def claim_job(self, job_id: UUID) -> bool:
        """queued -> running, atomico. False se outro worker ja pegou ou nao esta na fila."""

    def finish_job_success(
        self,
        job_id: UUID,
        document_id: UUID,
        result: dict,
        page_paths: list[str],
        method: str,
        collected_at: date | None,
        lab_name: str | None,
    ) -> None: ...

    def finish_job_failed(self, job_id: UUID, document_id: UUID, code: str, message: str) -> None: ...

    def fail_stale_jobs(self, older_than_minutes: int) -> int:
        """Jobs 'running' parados (processo caiu no meio): marca como falhos. Devolve quantos."""

    # --- revisao
    def confirm_document(
        self, patient_id: UUID, document_id: UUID, collected_at: date, lab_name: str | None, observations: list[dict]
    ) -> dict:
        """Atomico e idempotente. Levanta DocumentNotFound / DocumentNotReviewable / NoObservations."""
