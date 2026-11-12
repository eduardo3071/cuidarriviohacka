"""Repositorio em memoria: MESMAS regras das funcoes SQL (create_document_once / confirm_document).

Serve aos testes e a rodar a API sem banco. As regras daqui foram escritas contra o
comportamento verificado no banco real (ver supabase/migrations/..._documents_pipeline.sql).
"""
import threading
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

from .base import (
    CreateOnceResult,
    DocumentNotFound,
    DocumentNotReviewable,
    DocumentRecord,
    JobRecord,
    NoObservations,
)


class MemoryRepository:
    def __init__(self, patients: dict[UUID, UUID] | None = None) -> None:
        self.patients = patients or {}  # user_id -> patient_id
        self.documents: dict[UUID, DocumentRecord] = {}
        self.jobs: dict[UUID, JobRecord] = {}
        self.job_updated_at: dict[UUID, datetime] = {}
        self.observations: list[dict] = []
        self._lock = threading.RLock()

    def get_patient_id_for_user(self, user_id: UUID) -> UUID | None:
        return self.patients.get(user_id)

    # ------------------------------------------------------------ upload
    def create_document_once(self, patient_id: UUID, storage_path: str, sha256: str, mime: str) -> CreateOnceResult:
        with self._lock:
            doc = next(
                (d for d in self.documents.values() if d.patient_id == patient_id and d.sha256 == sha256), None
            )
            if doc is None:
                doc = DocumentRecord(
                    id=uuid4(), patient_id=patient_id, storage_path=storage_path, sha256=sha256,
                    mime_type=mime, status="uploaded",
                )  # fmt: skip
                self.documents[doc.id] = doc
                return CreateOnceResult(document_id=doc.id, job_id=self._new_job(doc).id, is_new=True, status="uploaded")
            if doc.status == "failed":  # reenvio apos falha: reabre com novo job
                doc.status = "uploaded"
                return CreateOnceResult(document_id=doc.id, job_id=self._new_job(doc).id, is_new=True, status="uploaded")
            last = max((j for j in self.jobs.values() if j.document_id == doc.id), key=lambda j: j.created_at)
            return CreateOnceResult(document_id=doc.id, job_id=last.id, is_new=False, status=doc.status)

    def _new_job(self, doc: DocumentRecord) -> JobRecord:
        job = JobRecord(
            id=uuid4(), patient_id=doc.patient_id, document_id=doc.id, status="queued",
            created_at=datetime.now(UTC) + timedelta(microseconds=len(self.jobs)),
        )  # fmt: skip
        self.jobs[job.id] = job
        self.job_updated_at[job.id] = job.created_at
        return job

    # ------------------------------------------------------------ leitura
    def get_document(self, patient_id: UUID, document_id: UUID) -> DocumentRecord | None:
        d = self.documents.get(document_id)
        return d.model_copy() if d and d.patient_id == patient_id else None

    def get_job(self, patient_id: UUID, job_id: UUID) -> JobRecord | None:
        j = self.jobs.get(job_id)
        return j.model_copy() if j and j.patient_id == patient_id else None

    def get_latest_job(self, patient_id: UUID, document_id: UUID) -> JobRecord | None:
        js = [j for j in self.jobs.values() if j.document_id == document_id and j.patient_id == patient_id]
        return max(js, key=lambda j: j.created_at).model_copy() if js else None

    def get_job_internal(self, job_id: UUID) -> JobRecord | None:
        j = self.jobs.get(job_id)
        return j.model_copy() if j else None

    def get_document_internal(self, document_id: UUID) -> DocumentRecord | None:
        d = self.documents.get(document_id)
        return d.model_copy() if d else None

    # ------------------------------------------------------------ worker
    def claim_job(self, job_id: UUID) -> bool:
        with self._lock:
            j = self.jobs.get(job_id)
            if j is None or j.status != "queued":
                return False
            j.status = "running"
            self.job_updated_at[job_id] = datetime.now(UTC)
            if j.document_id:
                self.documents[j.document_id].status = "processing"
            return True

    def finish_job_success(self, job_id, document_id, result, page_paths, method, collected_at, lab_name) -> None:
        with self._lock:
            j, d = self.jobs[job_id], self.documents[document_id]
            j.status, j.result = "succeeded", result
            d.status, d.page_paths, d.extraction_method = "pending_review", list(page_paths), method
            d.collected_at, d.lab_name = collected_at, lab_name
            self.job_updated_at[job_id] = datetime.now(UTC)

    def finish_job_failed(self, job_id, document_id, code, message) -> None:
        with self._lock:
            j, d = self.jobs[job_id], self.documents[document_id]
            j.status, j.error_code, j.error = "failed", code, message
            d.status = "failed"
            self.job_updated_at[job_id] = datetime.now(UTC)

    def fail_stale_jobs(self, older_than_minutes: int) -> int:
        cutoff = datetime.now(UTC) - timedelta(minutes=older_than_minutes)
        n = 0
        with self._lock:
            for j in self.jobs.values():
                if j.status == "running" and self.job_updated_at[j.id] < cutoff:
                    j.status, j.error_code = "failed", "interrupted"
                    j.error = "O processamento foi interrompido. Envie o arquivo de novo."
                    if j.document_id:
                        self.documents[j.document_id].status = "failed"
                    n += 1
        return n

    # ------------------------------------------------------------ revisao
    def confirm_document(self, patient_id, document_id, collected_at: date, lab_name, observations) -> dict:
        with self._lock:
            d = self.documents.get(document_id)
            if d is None or d.patient_id != patient_id:
                raise DocumentNotFound()
            if d.status == "confirmed":
                n = sum(1 for o in self.observations if o["document_id"] == document_id)
                return {"confirmed": n, "submitted": n, "already": True}
            if d.status != "pending_review":
                raise DocumentNotReviewable(d.status)
            if not observations:
                raise NoObservations()
            seen: set[tuple] = set()
            inserted = 0
            for o in observations:
                key = (o["raw_name"], collected_at)  # observations_dedupe: (paciente, documento, nome, data)
                if key in seen:
                    continue
                seen.add(key)
                self.observations.append({**o, "document_id": document_id, "patient_id": patient_id,
                                          "collected_at": collected_at, "lab_name": lab_name, "status": "confirmed"})  # fmt: skip
                inserted += 1
            d.status, d.collected_at = "confirmed", collected_at
            d.lab_name = lab_name or d.lab_name
            return {"confirmed": inserted, "submitted": len(observations), "already": False}
