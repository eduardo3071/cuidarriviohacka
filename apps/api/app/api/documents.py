import hashlib
import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Response, UploadFile

from app.core.services import Services
from app.repositories.base import DocumentNotFound, DocumentNotReviewable, NoObservations
from app.services.documents.pipeline import process_job
from app.storage.base import StorageError

from .deps import current_patient, get_services
from .errors import api_error
from .schemas import (
    ConfirmRequest,
    ConfirmResponse,
    DocumentOut,
    JobOut,
    PageOut,
    ReviewOut,
    UploadResponse,
)

router = APIRouter(tags=["documents"])
log = logging.getLogger("rivio.api")


def sniff_type(data: bytes) -> tuple[str, str] | None:
    """Tipo REAL pelo conteudo (o Content-Type enviado pelo cliente nao e confiavel)."""
    if data.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


@router.post("/documents", response_model=UploadResponse, status_code=202)
def upload_document(
    response: Response,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    patient_id: UUID = Depends(current_patient),
    svc: Services = Depends(get_services),
) -> UploadResponse:
    """Envia um laudo (PDF, JPEG, PNG ou WebP).

    202: novo, entra na fila de extracao. 200: o MESMO arquivo ja existia (idempotente: nada novo e criado;
    se a tentativa anterior tinha falhado, ela e reaberta e responde 202).
    """
    data = file.file.read(svc.max_upload_bytes + 1)
    if len(data) > svc.max_upload_bytes:
        raise api_error(413, "file_too_large", f"O arquivo passa de {svc.max_upload_bytes // (1024 * 1024)} MB.")
    if not data:
        raise api_error(422, "empty_file", "O arquivo esta vazio.")
    kind = sniff_type(data)
    if kind is None:
        raise api_error(415, "unsupported_type", "Envie um PDF, JPEG, PNG ou WebP.")
    mime, ext = kind

    sha256 = hashlib.sha256(data).hexdigest()
    path = f"{patient_id}/{sha256}.{ext}"  # enderecado por conteudo: regravar o mesmo arquivo e inofensivo
    try:
        svc.storage.put(path, data, mime)
    except StorageError as e:
        log.error("falha ao gravar no storage: %s", e)
        raise api_error(502, "storage_unavailable", "Nao foi possivel guardar o arquivo agora. Tente de novo.") from e

    created = svc.repo.create_document_once(patient_id, path, sha256, mime)
    if created.is_new:
        background.add_task(process_job, svc, created.job_id)
    else:
        response.status_code = 200
    return UploadResponse(
        document_id=created.document_id, job_id=created.job_id, status=created.status, duplicate=not created.is_new
    )


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: UUID, patient_id: UUID = Depends(current_patient), svc: Services = Depends(get_services)) -> JobOut:
    job = svc.repo.get_job(patient_id, job_id)
    if job is None:
        raise api_error(404, "not_found", "Job nao encontrado.")
    return JobOut(**job.model_dump(exclude={"patient_id", "result"}))


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: UUID, patient_id: UUID = Depends(current_patient), svc: Services = Depends(get_services)
) -> DocumentOut:
    doc = svc.repo.get_document(patient_id, document_id)
    if doc is None:
        raise api_error(404, "not_found", "Documento nao encontrado.")
    return DocumentOut(**doc.model_dump(include=set(DocumentOut.model_fields)))


@router.get("/documents/{document_id}/review", response_model=ReviewOut)
def get_review(
    document_id: UUID, patient_id: UUID = Depends(current_patient), svc: Services = Depends(get_services)
) -> ReviewOut:
    """O que a extracao leu, para o usuario revisar: leituras (com caixa e confianca) e as paginas."""
    doc = svc.repo.get_document(patient_id, document_id)
    if doc is None:
        raise api_error(404, "not_found", "Documento nao encontrado.")
    if doc.status != "pending_review":
        extra = {}
        if doc.status == "failed":
            job = svc.repo.get_latest_job(patient_id, document_id)
            extra = {"error_code": job.error_code, "error": job.error} if job else {}
        raise api_error(409, "not_reviewable", f"O documento esta '{doc.status}'.", status=doc.status, **extra)

    job = svc.repo.get_latest_job(patient_id, document_id)
    result = (job.result if job else None) or {}
    try:
        pages = [PageOut(page=i, url=svc.storage.signed_url(p)) for i, p in enumerate(doc.page_paths, start=1)]
    except StorageError as e:
        log.error("falha ao assinar URL de pagina: %s", e)
        raise api_error(502, "storage_unavailable", "Nao foi possivel carregar as paginas agora.") from e
    return ReviewOut(
        document_id=doc.id,
        method=result.get("method") or doc.extraction_method or "unknown",
        lab_name=doc.lab_name,
        collected_at=doc.collected_at,
        warnings=result.get("warnings", []),
        observations=result.get("observations", []),
        pages=pages,
    )


@router.post("/documents/{document_id}/confirm", response_model=ConfirmResponse)
def confirm_document(
    document_id: UUID,
    body: ConfirmRequest,
    patient_id: UUID = Depends(current_patient),
    svc: Services = Depends(get_services),
) -> ConfirmResponse:
    """Grava as leituras revisadas no historico. Idempotente: repetir devolve `already: true`."""
    onto = svc.caps.ontology
    rows = []
    for o in body.observations:
        if o.canonical_name is not None and o.canonical_name not in onto.biomarkers:
            raise api_error(422, "unknown_biomarker", f"Biomarcador desconhecido: {o.canonical_name!r}.")
        row = o.model_dump(mode="json")
        if o.canonical_name is None:  # tenta resolver pelo nome lido; sem match fica sem normalizar
            bm = onto.resolve(o.raw_name)
            row["canonical_name"] = bm.canonical_name if bm else None
        rows.append(row)
    try:
        result = svc.repo.confirm_document(patient_id, document_id, body.collected_at, body.lab_name, rows)
    except DocumentNotFound as e:
        raise api_error(404, "not_found", "Documento nao encontrado.") from e
    except DocumentNotReviewable as e:
        raise api_error(409, "not_reviewable", f"O documento esta '{e.status}'.", status=e.status) from e
    except NoObservations as e:
        raise api_error(422, "no_observations", "Nenhuma leitura para confirmar.") from e
    return ConfirmResponse(**result)
