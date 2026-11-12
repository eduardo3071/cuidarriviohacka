"""Adaptadores de producao (Supabase Storage, SQL, montagem dos servicos) SEM servicos reais.

Honestidade: isto verifica os pedidos montados e o mapeamento de erros. Nao prova que o Supabase
responde assim: falta rodar contra o projeto real (precisa das chaves).
"""
import json
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.exc import DBAPIError

from app.core.config import Settings
from app.core.services import ServiceConfigError, build_services
from app.repositories import sql
from app.repositories.base import DocumentNotFound, DocumentNotReviewable, NoObservations
from app.services.llm.anthropic_client import AnthropicLLM
from app.storage.base import StorageError
from app.storage.supabase import SupabaseStorage

DATA = Path(__file__).resolve().parents[3] / "data"
KEY = "service-role-SECRETO"


# ================================================================ Supabase Storage
def storage(handler) -> SupabaseStorage:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return SupabaseStorage("https://p.supabase.co/", KEY, "documents", client=client)


def test_put_builds_an_upsert_request_with_service_credentials():
    seen = {}

    def handler(req: httpx.Request):
        seen.update(method=req.method, url=str(req.url), headers=req.headers, body=req.content)
        return httpx.Response(200, json={"Key": "documents/x"})

    storage(handler).put("pac-1/abc def.pdf", b"%PDF-bytes", "application/pdf")
    assert seen["method"] == "POST"
    assert seen["url"] == "https://p.supabase.co/storage/v1/object/documents/pac-1/abc%20def.pdf"
    assert seen["headers"]["apikey"] == KEY and seen["headers"]["authorization"] == f"Bearer {KEY}"
    assert seen["headers"]["x-upsert"] == "true" and seen["headers"]["content-type"] == "application/pdf"
    assert seen["body"] == b"%PDF-bytes"


def test_get_returns_the_bytes():
    s = storage(lambda req: httpx.Response(200, content=b"conteudo") if req.method == "GET" else httpx.Response(500))
    assert s.get("pac/a.pdf") == b"conteudo"


@pytest.mark.parametrize("op", ["put", "get", "sign"])
def test_http_errors_become_storage_error_without_leaking_body_or_key(op):
    s = storage(lambda req: httpx.Response(403, text=f"negado para {KEY} corpo-sensivel"))
    call = {"put": lambda: s.put("p", b"x", "a/b"), "get": lambda: s.get("p"), "sign": lambda: s.signed_url("p")}[op]
    with pytest.raises(StorageError) as ei:
        call()
    assert "403" in str(ei.value) and KEY not in str(ei.value) and "corpo-sensivel" not in str(ei.value)


def test_network_failure_becomes_storage_error():
    def handler(req):
        raise httpx.ConnectError("sem rede")

    with pytest.raises(StorageError):
        storage(handler).get("p")


def test_signed_url_is_assembled_from_the_relative_path():
    def handler(req: httpx.Request):
        assert str(req.url) == "https://p.supabase.co/storage/v1/object/sign/documents/pac/page-1.jpg"
        assert json.loads(req.content) == {"expiresIn": 600}
        return httpx.Response(200, json={"signedURL": "/object/sign/documents/pac/page-1.jpg?token=tkn"})

    assert storage(handler).signed_url("pac/page-1.jpg") == (
        "https://p.supabase.co/storage/v1/object/sign/documents/pac/page-1.jpg?token=tkn"
    )


def test_signed_url_without_field_is_an_error():
    with pytest.raises(StorageError):
        storage(lambda req: httpx.Response(200, json={})).signed_url("p")


# ================================================================ SQL: erros de dominio
def db_error(sqlstate, primary, detail=None):
    diag = SimpleNamespace(message_primary=primary, message_detail=detail)
    return DBAPIError("select ...", {}, SimpleNamespace(sqlstate=sqlstate, diag=diag))


def test_confirm_errors_are_translated_to_domain_exceptions():
    assert isinstance(sql._map_confirm_error(db_error("P0002", "document_not_found")), DocumentNotFound)
    mapped = sql._map_confirm_error(db_error("P0001", "document_not_reviewable", "uploaded"))
    assert isinstance(mapped, DocumentNotReviewable) and mapped.status == "uploaded"
    assert isinstance(sql._map_confirm_error(db_error("P0001", "no_observations")), NoObservations)


def test_unknown_database_errors_are_not_swallowed():
    e = db_error("23505", "duplicate key")
    assert sql._map_confirm_error(e) is e


def test_engine_is_configured_for_the_transaction_pooler():
    e = sql.make_engine("postgresql+psycopg://u:p@localhost:6543/db")
    assert (e.dialect.name, e.dialect.driver) == ("postgresql", "psycopg")
    assert e.pool._pre_ping is True


# ================================================================ SQL: parametros batem com os :nomes
class FakeResult:
    def __init__(self, row=None, scalar=None, rows=()):
        self.row, self._scalar, self.rows = row, scalar, list(rows)

    first = lambda self: self.row  # noqa: E731
    one = lambda self: self.row  # noqa: E731
    all = lambda self: self.rows  # noqa: E731
    scalar = lambda self: self._scalar  # noqa: E731
    scalar_one = lambda self: self._scalar  # noqa: E731


class FakeConn:
    def __init__(self, results):
        self.results, self.executed = list(results), []

    def execute(self, stmt, params=None):
        self.executed.append((stmt, params or {}))
        return self.results.pop(0) if self.results else FakeResult()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeEngine:
    def __init__(self, *results):
        self.conn = FakeConn(results)

    connect = begin = lambda self: self.conn  # noqa: E731


def assert_binds_match(conn: FakeConn):
    """Cada comando recebe exatamente os parametros que declara (pega :nome digitado errado)."""
    assert conn.executed, "nada foi executado"
    for stmt, params in conn.executed:
        declared = set(stmt.compile().params)
        assert declared == set(params), f"{stmt}: declara {declared} mas recebeu {set(params)}"


P, D, J = uuid4(), uuid4(), uuid4()


def test_sql_statements_bind_exactly_their_parameters():
    row = SimpleNamespace(out_document_id=D, out_job_id=J, out_is_new=True, out_status="uploaded", document_id=D)
    eng = FakeEngine(
        FakeResult(row=row),  # create_document_once
        FakeResult(row=row), FakeResult(),  # claim_job (job + documento)
        FakeResult(), FakeResult(),  # finish_job_success (job + documento)
        FakeResult(), FakeResult(),  # finish_job_failed
        FakeResult(rows=[row]), FakeResult(),  # fail_stale_jobs
        FakeResult(scalar={"confirmed": 1, "submitted": 1, "already": False}),  # confirm_document
        FakeResult(scalar=P),  # get_patient_id_for_user
    )  # fmt: skip
    repo = sql.SqlRepository(eng)
    created = repo.create_document_once(P, "p/a.pdf", "sha", "application/pdf")
    assert (created.document_id, created.job_id, created.is_new) == (D, J, True)
    assert repo.claim_job(J) is True
    repo.finish_job_success(J, D, {"observations": []}, ["p/page-1.jpg"], "ocr", date(2023, 10, 17), "Lab")
    repo.finish_job_failed(J, D, "no_results", "msg")
    assert repo.fail_stale_jobs(15) == 1
    assert repo.confirm_document(P, D, date(2023, 10, 17), "Lab", [{"raw_name": "x", "value": 1}])["confirmed"] == 1
    assert repo.get_patient_id_for_user(uuid4()) == P
    assert_binds_match(eng.conn)


def test_claim_job_returns_false_when_not_queued():
    assert sql.SqlRepository(FakeEngine(FakeResult(row=None))).claim_job(J) is False


def test_owner_queries_always_filter_by_patient():
    eng = FakeEngine(FakeResult(row=None), FakeResult(row=None), FakeResult(row=None))
    repo = sql.SqlRepository(eng)
    repo.get_document(P, D)
    repo.get_job(P, J)
    repo.get_latest_job(P, D)
    for stmt, params in eng.conn.executed:
        assert "patient_id = :p" in str(stmt) and params["p"] == P


# ================================================================ montagem dos servicos
def settings(**kw) -> Settings:
    return Settings(_env_file=None, ontology_dir=str(DATA / "ontology"), **kw)


def test_missing_configuration_lists_names_never_values():
    with pytest.raises(ServiceConfigError) as ei:
        build_services(settings(supabase_url="https://p.supabase.co"))
    msg = str(ei.value)
    assert "SUPABASE_SECRET_KEY" in msg and "DATABASE_URL" in msg and "SUPABASE_URL" not in msg.replace("SUPABASE_URL=", "")
    assert "p.supabase.co" not in msg


def test_services_are_assembled_from_settings_without_touching_the_network():
    svc = build_services(
        settings(
            supabase_url="https://p.supabase.co/",
            supabase_secret_key=KEY,
            database_url="postgresql+psycopg://u:p@localhost:6543/db",
            max_upload_mb=5,
        )
    )
    assert svc.max_upload_bytes == 5 * 1024 * 1024
    assert svc.caps.llm is None and svc.caps.ocr_enabled is False and len(svc.caps.ontology.biomarkers) >= 20
    assert isinstance(svc.repo, sql.SqlRepository) and isinstance(svc.storage, SupabaseStorage)


def test_llm_and_ocr_are_switched_on_by_settings():
    svc = build_services(
        settings(
            supabase_url="https://p.supabase.co",
            supabase_secret_key=KEY,
            database_url="postgresql+psycopg://u:p@localhost:6543/db",
            anthropic_api_key="sk-ant-teste",
            llm_model="claude-sonnet-5-5",
            ocr_enabled=True,
        )
    )
    assert svc.caps.ocr_enabled is True
    assert isinstance(svc.caps.llm, AnthropicLLM) and svc.caps.llm.model == "claude-sonnet-5-5"


# ================================================================ chave secreta nova (sb_secret_...)
def test_new_secret_key_is_not_a_jwt_so_it_goes_only_in_the_apikey_header():
    seen = {}

    def handler(req: httpx.Request):
        seen["headers"] = req.headers
        return httpx.Response(200, json={})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    key = "sb_secret_" + "x" * 24
    SupabaseStorage("https://p.supabase.co", key, "documents", client=client).put("a/b.pdf", b"x", "application/pdf")
    assert seen["headers"]["apikey"] == key
    assert "authorization" not in seen["headers"], "sb_secret nao e JWT: nunca em Authorization: Bearer"


def test_legacy_jwt_key_keeps_apikey_and_bearer():
    from app.storage.supabase import auth_headers

    legacy = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.assinatura"
    assert auth_headers(legacy) == {"apikey": legacy, "Authorization": f"Bearer {legacy}"}
    assert auth_headers("sb_secret_abc") == {"apikey": "sb_secret_abc"}


def test_secret_key_env_name_and_legacy_alias(monkeypatch):
    for n in ("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        monkeypatch.delenv(n, raising=False)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "legado")
    assert Settings(_env_file=None).supabase_secret_key == "legado", "o nome antigo continua funcionando"
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "novo")
    assert Settings(_env_file=None).supabase_secret_key == "novo", "o nome novo tem prioridade"
