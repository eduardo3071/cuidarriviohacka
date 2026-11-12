"""Processa um job de extracao em segundo plano: baixa o arquivo, extrai, guarda as paginas e
deixa o documento em 'pending_review' (ou 'failed' com um motivo claro). Nunca levanta."""
import logging
from datetime import date
from uuid import UUID

from app.core.services import Services
from app.services.extraction.router import ExtractionError, extract_document

log = logging.getLogger("rivio.pipeline")


def _parse_iso(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None  # a IA pode devolver data mal formada: o usuario confirma na revisao


def process_job(svc: Services, job_id: UUID) -> None:
    repo = svc.repo
    job = repo.get_job_internal(job_id)
    if job is None or job.document_id is None:
        log.warning("job %s inexistente ou sem documento", job_id)
        return
    if not repo.claim_job(job_id):  # outro worker ja pegou, ou nao esta na fila: nao processa duas vezes
        return
    doc = repo.get_document_internal(job.document_id)
    try:
        data = svc.storage.get(doc.storage_path)
        out = extract_document(data, doc.mime_type, svc.caps)
        page_paths = []
        for i, jpeg in enumerate(out.page_images, start=1):
            path = f"{doc.patient_id}/{doc.sha256}/page-{i}.jpg"
            svc.storage.put(path, jpeg, "image/jpeg")
            page_paths.append(path)
        result = {
            "method": out.method,
            "lab_name": out.lab_name,
            "collected_at": out.collected_at,
            "warnings": out.warnings,
            "observations": [o.model_dump(mode="json") for o in out.observations],
        }
        repo.finish_job_success(
            job_id, doc.id, result, page_paths, out.method, _parse_iso(out.collected_at), out.lab_name
        )
    except ExtractionError as e:
        log.info("job %s sem resultado: %s", job_id, e.code)
        repo.finish_job_failed(job_id, doc.id, e.code, e.message)
    except Exception:  # noqa: BLE001  qualquer falha vira 'failed' com mensagem generica (detalhe so no log)
        log.exception("job %s falhou", job_id)
        repo.finish_job_failed(job_id, doc.id, "internal_error", "Falha interna ao processar o documento. Tente novamente.")
