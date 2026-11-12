"""Repositorio PostgreSQL (SQLAlchemy Core, sincrono, driver psycopg 3).

A logica atomica (criar documento uma vez, confirmar sem duplicar) vive nas funcoes SQL
create_document_once / confirm_document: aqui so as chamamos. As consultas de dono sempre
filtram por patient_id (a conexao usa um papel que ignora RLS, entao a checagem e do codigo).

ATENCAO: este adaptador precisa de DATABASE_URL (senha do banco) e NAO foi executado contra o
banco real nesta sessao; as funcoes SQL que ele chama foram verificadas la. Os testes cobrem a
mesma interface em MemoryRepository.
"""
import json
from datetime import date
from uuid import UUID

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import DBAPIError

from .base import (
    CreateOnceResult,
    DocumentNotFound,
    DocumentNotReviewable,
    DocumentRecord,
    JobRecord,
    NoObservations,
)

_DOC_COLS = "id, patient_id, storage_path, sha256, mime_type, status, lab_name, collected_at, extraction_method, page_paths"
_JOB_COLS = "id, patient_id, document_id, status, error_code, error, result, created_at"


def make_engine(database_url: str) -> Engine:
    """`prepare_threshold=None`: sem prepared statements no servidor (exigido pelo pooler do Supabase
    em modo transaction, porta 6543)."""
    return create_engine(
        database_url,
        pool_size=3,
        max_overflow=2,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"prepare_threshold": None},
    )


def _doc(row) -> DocumentRecord:
    return DocumentRecord(**row._mapping)


def _job(row) -> JobRecord:
    return JobRecord(**row._mapping)


class SqlRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def get_patient_id_for_user(self, user_id: UUID) -> UUID | None:
        with self.engine.connect() as c:
            return c.execute(text("select id from public.patients where user_id = :u"), {"u": user_id}).scalar()

    def create_document_once(self, patient_id, storage_path, sha256, mime) -> CreateOnceResult:
        with self.engine.begin() as c:
            r = c.execute(
                text("select * from public.create_document_once(:p, :path, :sha, :mime)"),
                {"p": patient_id, "path": storage_path, "sha": sha256, "mime": mime},
            ).one()
        return CreateOnceResult(
            document_id=r.out_document_id, job_id=r.out_job_id, is_new=r.out_is_new, status=r.out_status
        )

    def get_document(self, patient_id, document_id) -> DocumentRecord | None:
        with self.engine.connect() as c:
            row = c.execute(
                text(f"select {_DOC_COLS} from public.documents where id = :d and patient_id = :p"),
                {"d": document_id, "p": patient_id},
            ).first()
        return _doc(row) if row else None

    def get_job(self, patient_id, job_id) -> JobRecord | None:
        with self.engine.connect() as c:
            row = c.execute(
                text(f"select {_JOB_COLS} from public.jobs where id = :j and patient_id = :p"),
                {"j": job_id, "p": patient_id},
            ).first()
        return _job(row) if row else None

    def get_latest_job(self, patient_id, document_id) -> JobRecord | None:
        with self.engine.connect() as c:
            row = c.execute(
                text(
                    f"select {_JOB_COLS} from public.jobs where document_id = :d and patient_id = :p "
                    "order by created_at desc limit 1"
                ),
                {"d": document_id, "p": patient_id},
            ).first()
        return _job(row) if row else None

    def get_job_internal(self, job_id) -> JobRecord | None:
        with self.engine.connect() as c:
            row = c.execute(text(f"select {_JOB_COLS} from public.jobs where id = :j"), {"j": job_id}).first()
        return _job(row) if row else None

    def get_document_internal(self, document_id) -> DocumentRecord | None:
        with self.engine.connect() as c:
            row = c.execute(text(f"select {_DOC_COLS} from public.documents where id = :d"), {"d": document_id}).first()
        return _doc(row) if row else None

    def claim_job(self, job_id) -> bool:
        with self.engine.begin() as c:
            claimed = c.execute(
                text("update public.jobs set status = 'running' where id = :j and status = 'queued' returning document_id"),
                {"j": job_id},
            ).first()
            if claimed is None:
                return False
            if claimed.document_id:
                c.execute(
                    text("update public.documents set status = 'processing' where id = :d"),
                    {"d": claimed.document_id},
                )
            return True

    def finish_job_success(self, job_id, document_id, result, page_paths, method, collected_at, lab_name) -> None:
        with self.engine.begin() as c:  # job e documento mudam juntos ou nenhum
            c.execute(
                text("update public.jobs set status = 'succeeded', result = cast(:r as jsonb) where id = :j"),
                {"r": json.dumps(result), "j": job_id},
            )
            c.execute(
                text(
                    "update public.documents set status = 'pending_review', page_paths = :pp, "
                    "extraction_method = :m, collected_at = :c, lab_name = :l where id = :d"
                ),
                {"pp": page_paths, "m": method, "c": collected_at, "l": lab_name, "d": document_id},
            )

    def finish_job_failed(self, job_id, document_id, code, message) -> None:
        with self.engine.begin() as c:
            c.execute(
                text("update public.jobs set status = 'failed', error_code = :c, error = :e where id = :j"),
                {"c": code, "e": message, "j": job_id},
            )
            c.execute(text("update public.documents set status = 'failed' where id = :d"), {"d": document_id})

    def fail_stale_jobs(self, older_than_minutes: int) -> int:
        with self.engine.begin() as c:
            rows = c.execute(
                text(
                    "update public.jobs set status = 'failed', error_code = 'interrupted', "
                    "error = 'O processamento foi interrompido. Envie o arquivo de novo.' "
                    "where status = 'running' and updated_at < now() - make_interval(mins => :m) "
                    "returning document_id"
                ),
                {"m": older_than_minutes},
            ).all()
            doc_ids = [r.document_id for r in rows if r.document_id]
            if doc_ids:
                c.execute(
                    text("update public.documents set status = 'failed' where id = any(:ids) and status = 'processing'"),
                    {"ids": doc_ids},
                )
            return len(rows)

    def confirm_document(self, patient_id, document_id, collected_at: date, lab_name, observations) -> dict:
        try:
            with self.engine.begin() as c:
                return c.execute(
                    text("select public.confirm_document(:p, :d, :c, :l, cast(:o as jsonb))"),
                    {"p": patient_id, "d": document_id, "c": collected_at, "l": lab_name, "o": json.dumps(observations)},
                ).scalar_one()
        except DBAPIError as e:
            raise _map_confirm_error(e) from e


def _map_confirm_error(e: DBAPIError) -> Exception:
    """Traduz os erros levantados por confirm_document (sqlstate P0002 / P0001) em excecoes de dominio."""
    orig = getattr(e, "orig", None)
    sqlstate = getattr(orig, "sqlstate", None)
    diag = getattr(orig, "diag", None)
    message = getattr(diag, "message_primary", None)
    if sqlstate == "P0002":
        return DocumentNotFound()
    if sqlstate == "P0001" and message == "document_not_reviewable":
        return DocumentNotReviewable(getattr(diag, "message_detail", None) or "unknown")
    if sqlstate == "P0001" and message == "no_observations":
        return NoObservations()
    return e
