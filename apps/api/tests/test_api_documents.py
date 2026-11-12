"""API de documentos de ponta a ponta com repositorio/storage em memoria e verificador falso.

Cobre: upload idempotente, fila, revisao, confirmacao idempotente, isolamento entre pacientes,
validacao de entrada, falhas (extracao, storage, processo interrompido).
"""
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import AuthError, AuthUser
from app.core.services import ServiceConfigError, Services
from app.main import create_app
from app.repositories.memory import MemoryRepository
from app.services.documents import pipeline
from app.services.extraction.llm_extractor import LLMExtraction, LLMObservation
from app.services.extraction.router import Capabilities
from app.services.llm.base import LLMResult
from app.services.normalization.ontology import load_ontology
from app.storage.base import StorageError
from app.storage.memory import MemoryStorage

DATA = Path(__file__).resolve().parents[3] / "data"
EXAMS = DATA / "synthetic" / "marta" / "exams"
AURORA = (EXAMS / "aurora_2023.pdf").read_bytes()
VITA = (EXAMS / "vita_2026.pdf").read_bytes()
TODAY = datetime.now(UTC).date().isoformat()


@pytest.fixture(scope="module")
def onto():
    return load_ontology(DATA / "ontology")


class FakeVerifier:
    def __init__(self, users):
        self.users = users

    def verify(self, token):
        if token not in self.users:
            raise AuthError("token invalido")
        return AuthUser(self.users[token])


class FakeLLM:
    model = "fake"

    def __init__(self):
        self.calls = 0

    def parse(self, *, system, user_text, images=(), schema):
        self.calls += 1
        obs = LLMObservation(raw_name="Glicemia de jejum", value=118, unit="mg/dL", ref_low=70, ref_high=110, ref_text="70 a 110")
        return LLMResult(LLMExtraction(lab_name="Diagnosticos Vita", collected_at=None, observations=[obs]), 1, 1, "fake")


class Env:
    def __init__(self, onto, llm=None, storage=None, max_bytes=15 * 1024 * 1024):
        self.user_a, self.user_b, self.user_x = uuid4(), uuid4(), uuid4()
        self.patient_a, self.patient_b = uuid4(), uuid4()
        self.repo = MemoryRepository({self.user_a: self.patient_a, self.user_b: self.patient_b})
        self.storage = storage or MemoryStorage()
        self.llm = llm
        self.svc = Services(
            self.repo, self.storage, Capabilities(onto, llm=llm),
            FakeVerifier({"tok-a": self.user_a, "tok-b": self.user_b, "tok-x": self.user_x}),
            max_upload_bytes=max_bytes,
        )  # fmt: skip
        self.client = TestClient(create_app(self.svc))

    def upload(self, data=AURORA, token="tok-a", name="laudo.pdf", ctype="application/pdf"):
        return self.client.post("/documents", files={"file": (name, data, ctype)}, headers=bearer(token))

    def get(self, url, token="tok-a"):
        return self.client.get(url, headers=bearer(token))

    def confirm(self, doc_id, body, token="tok-a"):
        return self.client.post(f"/documents/{doc_id}/confirm", json=body, headers=bearer(token))


def bearer(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


@pytest.fixture
def env(onto):
    return Env(onto)


def confirm_body(review, **over):
    body = {"collected_at": review["collected_at"] or "2023-10-17", "lab_name": "Laboratorio Aurora", "observations": review["observations"]}
    body.update(over)
    return body


def uploaded_review(env, data=AURORA):
    r = env.upload(data)
    assert r.status_code == 202, r.text
    doc = r.json()["document_id"]
    review = env.get(f"/documents/{doc}/review")
    assert review.status_code == 200, review.text
    return doc, review.json()


# ================================================================ autenticacao e autorizacao
def test_requires_a_bearer_token(env):
    r = env.upload(token=None)
    assert r.status_code == 401 and r.json()["detail"]["code"] == "unauthenticated"
    assert r.headers["www-authenticate"] == "Bearer"


def test_rejects_invalid_token(env):
    r = env.upload(token="falso")
    assert r.status_code == 401 and r.json()["detail"]["code"] == "invalid_token"


def test_user_without_patient_profile_is_forbidden(env):
    r = env.upload(token="tok-x")
    assert r.status_code == 403 and r.json()["detail"]["code"] == "no_patient_profile"


def test_unconfigured_server_answers_503_not_500(monkeypatch):
    def boom(_settings):
        raise ServiceConfigError("Variaveis de ambiente ausentes: DATABASE_URL")

    monkeypatch.setattr("app.api.deps.build_services", boom)
    r = TestClient(create_app()).get(f"/jobs/{uuid4()}", headers=bearer("x"))
    assert r.status_code == 503 and r.json()["detail"]["code"] == "service_unavailable"


# ================================================================ upload
def test_upload_queues_processes_and_leaves_document_ready_for_review(env):
    r = env.upload()
    assert r.status_code == 202
    body = r.json()
    assert body["duplicate"] is False and body["status"] == "uploaded"

    job = env.get(f"/jobs/{body['job_id']}").json()
    assert job["status"] == "succeeded" and job["document_id"] == body["document_id"]
    doc = env.get(f"/documents/{body['document_id']}").json()
    assert doc["status"] == "pending_review" and doc["extraction_method"] == "text_layer"
    assert doc["collected_at"] == "2023-10-17"


def test_review_returns_readings_with_boxes_and_signed_pages(env):
    _, review = uploaded_review(env)
    assert review["method"] == "text_layer" and len(review["observations"]) == 11
    assert all(o["bbox"] and o["method"] == "text_layer" for o in review["observations"])
    assert len(review["pages"]) == 1 and review["pages"][0]["page"] == 1
    assert review["pages"][0]["url"].startswith("memory://") and "page-1.jpg" in review["pages"][0]["url"]
    assert review["collected_at"] == "2023-10-17"


def test_same_file_again_is_idempotent(env):
    first = env.upload().json()
    objects_after_first = set(env.storage.objects)
    second = env.upload()
    assert second.status_code == 200
    s = second.json()
    assert s["duplicate"] is True and (s["document_id"], s["job_id"]) == (first["document_id"], first["job_id"])
    assert len(env.repo.jobs) == 1 and len(env.repo.documents) == 1
    assert set(env.storage.objects) == objects_after_first


def test_declared_content_type_is_not_trusted(env):
    r = env.upload(AURORA, name="foto.png", ctype="image/png")  # e um PDF de verdade
    assert r.status_code == 202
    assert env.repo.documents[next(iter(env.repo.documents))].mime_type == "application/pdf"


@pytest.mark.parametrize(
    "data,status,code",
    [(b"", 422, "empty_file"), (b"isto e texto puro", 415, "unsupported_type"), (b"MZ\x90\x00 executavel", 415, "unsupported_type")],
)
def test_invalid_uploads(env, data, status, code):
    r = env.upload(data, name="x.bin", ctype="application/octet-stream")
    assert r.status_code == status and r.json()["detail"]["code"] == code
    assert not env.repo.documents, "arquivo recusado nao pode deixar documento"


def test_oversize_upload_is_rejected(onto):
    small = Env(onto, max_bytes=1024)
    r = small.upload(AURORA)  # PDF de ~2 KB
    assert r.status_code == 413 and r.json()["detail"]["code"] == "file_too_large"
    assert not small.repo.documents


def test_storage_failure_on_upload_creates_nothing(onto):
    class Down(MemoryStorage):
        def put(self, *a, **k):
            raise StorageError("rede")

    e = Env(onto, storage=Down())
    r = e.upload()
    assert r.status_code == 502 and r.json()["detail"]["code"] == "storage_unavailable"
    assert not e.repo.documents and not e.repo.jobs


# ================================================================ confirmacao
def test_confirm_saves_readings_and_is_idempotent(env):
    doc, review = uploaded_review(env)
    r = env.confirm(doc, confirm_body(review))
    assert r.status_code == 200 and r.json() == {"confirmed": 11, "submitted": 11, "already": False}
    assert len(env.repo.observations) == 11
    assert {o["canonical_name"] for o in env.repo.observations} >= {"Glicemia de jejum", "Colesterol LDL"}
    assert all(o["patient_id"] == env.patient_a and o["status"] == "confirmed" for o in env.repo.observations)

    again = env.confirm(doc, confirm_body(review))  # repetir: nada muda
    assert again.status_code == 200 and again.json()["already"] is True
    assert len(env.repo.observations) == 11

    assert env.get(f"/documents/{doc}").json()["status"] == "confirmed"
    after = env.get(f"/documents/{doc}/review")
    assert after.status_code == 409 and after.json()["detail"]["status"] == "confirmed"


def test_confirm_stores_what_the_user_corrected_not_what_was_extracted(env):
    doc, review = uploaded_review(env)
    obs = review["observations"]
    obs[0]["value"] = 999.0  # o usuario corrigiu um valor
    removed = obs.pop()  # e descartou uma leitura errada
    assert env.confirm(doc, confirm_body(review, observations=obs)).json()["confirmed"] == 10
    saved = {o["raw_name"]: o for o in env.repo.observations}
    assert saved[obs[0]["raw_name"]]["value"] == 999.0 and removed["raw_name"] not in saved


def test_confirm_resolves_missing_canonical_name_from_raw_name(env):
    doc, review = uploaded_review(env)
    for o in review["observations"]:
        o["canonical_name"] = None
    env.confirm(doc, confirm_body(review))
    assert all(o["canonical_name"] for o in env.repo.observations)


@pytest.mark.parametrize(
    "mutate,code_or_status",
    [
        (lambda b: b.update(collected_at="2999-01-01"), 422),
        (lambda b: b.update(collected_at="1800-01-01"), 422),
        (lambda b: b.update(observations=[]), 422),
        (lambda b: b["observations"][0].update(value="nan"), 422),
        (lambda b: b["observations"][0].update(bbox=[0.5, 0.5, 0.2, 0.2]), 422),
        (lambda b: b["observations"][0].update(bbox=[0.1, 0.1, 1.5, 0.9]), 422),
        (lambda b: b["observations"][0].update(ref_low=10, ref_high=1), 422),
        (lambda b: b["observations"][0].update(confidence=7), 422),
        (lambda b: b["observations"][0].update(method="hack"), 422),
        (lambda b: b["observations"][0].update(canonical_name="Exame Inventado"), 422),
    ],
)
def test_confirm_validates_input(env, mutate, code_or_status):
    doc, review = uploaded_review(env)
    body = confirm_body(review)
    mutate(body)
    r = env.confirm(doc, body)
    assert r.status_code == code_or_status
    assert not env.repo.observations and env.get(f"/documents/{doc}").json()["status"] == "pending_review"


def test_confirm_before_ready_is_a_conflict(env):
    doc = next(iter(env.repo.documents), None)
    assert doc is None
    d = env.repo.create_document_once(env.patient_a, "p", "sha", "application/pdf")  # criado mas nao processado
    body = {"collected_at": "2023-10-17", "observations": [{"raw_name": "x", "value": 1}]}
    r = env.confirm(d.document_id, body)
    assert r.status_code == 409 and r.json()["detail"]["status"] == "uploaded"


# ================================================================ isolamento entre pacientes
def test_another_patient_cannot_see_or_touch_my_document(env):
    doc, review = uploaded_review(env)
    job = env.repo.get_latest_job(env.patient_a, UUID(doc)).id
    for url in (f"/documents/{doc}", f"/documents/{doc}/review", f"/jobs/{job}"):
        assert env.get(url, token="tok-b").status_code == 404, url
    r = env.confirm(doc, confirm_body(review), token="tok-b")
    assert r.status_code == 404
    assert not env.repo.observations and env.get(f"/documents/{doc}").json()["status"] == "pending_review"


def test_same_file_from_two_patients_are_independent_documents(env):
    a, b = env.upload(token="tok-a").json(), env.upload(token="tok-b").json()
    assert a["document_id"] != b["document_id"] and b["duplicate"] is False
    assert {d.patient_id for d in env.repo.documents.values()} == {env.patient_a, env.patient_b}


def test_unknown_ids_are_404(env):
    assert env.get(f"/jobs/{uuid4()}").status_code == 404
    assert env.get(f"/documents/{uuid4()}").status_code == 404
    assert env.get("/documents/nao-e-uuid").status_code == 422


# ================================================================ falhas e retentativas
def test_unreadable_layout_fails_clearly_then_resend_retries(env):
    r = env.upload(VITA)  # sem OCR e sem IA: layout que a regra nao le
    assert r.status_code == 202
    job = env.get(f"/jobs/{r.json()['job_id']}").json()
    assert job["status"] == "failed" and job["error_code"] == "no_extractor"
    review = env.get(f"/documents/{r.json()['document_id']}/review")
    assert review.status_code == 409 and review.json()["detail"]["error_code"] == "no_extractor"

    again = env.upload(VITA)  # reenviar apos falha reabre, nao responde "duplicado"
    assert again.status_code == 202 and again.json()["duplicate"] is False
    assert again.json()["document_id"] == r.json()["document_id"] and again.json()["job_id"] != r.json()["job_id"]


def test_llm_fallback_through_the_api_and_user_edits_are_kept(onto):
    llm = FakeLLM()
    e = Env(onto, llm=llm)
    doc, review = uploaded_review(e, VITA)
    assert review["method"] == "llm" and review["collected_at"] == "2026-09-28"
    o = review["observations"][0]
    assert o["canonical_name"] == "Glicemia de jejum" and o["bbox"] is None
    o["value"] = 120.0
    assert e.confirm(doc, confirm_body(review, lab_name="  Diagnosticos Vita  ")).json()["confirmed"] == 1
    assert e.repo.observations[0]["value"] == 120.0 and e.repo.observations[0]["lab_name"] == "Diagnosticos Vita"


def test_unexpected_error_becomes_generic_failure_without_leaking_details(onto, monkeypatch):
    e = Env(onto)

    def explode(*a, **k):
        raise RuntimeError("segredo: postgres://user:senha@host/db")

    monkeypatch.setattr(pipeline, "extract_document", explode)
    r = e.upload()
    job = e.get(f"/jobs/{r.json()['job_id']}").json()
    assert job["status"] == "failed" and job["error_code"] == "internal_error"
    assert "senha" not in str(job) and "postgres" not in str(job)


def test_a_job_is_processed_only_once(onto):
    llm = FakeLLM()
    e = Env(onto, llm=llm)
    job_id = e.upload(VITA).json()["job_id"]
    first = llm.calls
    assert first >= 1
    pipeline.process_job(e.svc, UUID(job_id))  # ja nao esta na fila: nao refaz
    assert llm.calls == first


def test_interrupted_jobs_are_marked_failed_on_recovery(env):
    created = env.repo.create_document_once(env.patient_a, "p/x.pdf", "sha-x", "application/pdf")
    assert env.repo.claim_job(created.job_id)  # entrou em 'running' e o processo caiu
    env.repo.job_updated_at[created.job_id] = datetime.now(UTC) - timedelta(minutes=30)
    assert env.repo.fail_stale_jobs(15) == 1
    job = env.get(f"/jobs/{created.job_id}").json()
    assert job["status"] == "failed" and job["error_code"] == "interrupted"
    assert env.get(f"/documents/{created.document_id}").json()["status"] == "failed"
    assert env.repo.fail_stale_jobs(15) == 0, "so uma vez"


def test_recent_running_jobs_are_left_alone(env):
    created = env.repo.create_document_once(env.patient_a, "p/y.pdf", "sha-y", "application/pdf")
    env.repo.claim_job(created.job_id)
    assert env.repo.fail_stale_jobs(15) == 0
