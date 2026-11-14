"""Rotas de DEMONSTRACAO (/demo/extract e /demo/normalize): sem login, sem banco, sem storage.

Garante: desligadas por padrao (404 como rota inexistente), limite de uso, tipo/tamanho como no envio normal,
nunca usam a IA hospedada, e a normalizacao e a mesma do banco (unidade canonica e bandeira pela faixa do proprio laudo).
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.demo import RateLimiter
from app.main import create_app

EXAMS = Path(__file__).resolve().parents[3] / "data" / "synthetic" / "marta" / "exams"
AURORA = (EXAMS / "aurora_2023.pdf").read_bytes()
FOTO = (EXAMS / "aurora_2023_foto.jpg").read_bytes()


@pytest.fixture
def make():
    def _make(**over):
        app = create_app()
        base = {"demo_extract_enabled": True, "ocr_enabled": False, "demo_rate_per_minute": 1000, "anthropic_api_key": ""}
        app.state.settings = app.state.settings.model_copy(update={**base, **over})
        return TestClient(app), app

    return _make


def pdf(name="laudo.pdf", data=AURORA):
    return {"file": (name, data, "application/pdf")}


BODY = {
    "collected_at": "2019-08-21",
    "lab_name": "Lakeside Medical Centre",
    "observations": [{"raw_name": "Fasting Glucose", "value": 5.5, "unit": "mmol/L", "ref_low": 3.9, "ref_high": 5.5, "ref_text": "3.9 - 5.5"}],
}


# ---------------------------------------------------------------- desligadas por padrao
def test_disabled_responds_exactly_like_a_missing_route(make):
    client, _ = make(demo_extract_enabled=False)
    missing = client.get("/nao-existe")
    for r in (client.post("/demo/extract", files=pdf()), client.post("/demo/normalize", json=BODY)):
        assert r.status_code == 404 and r.json() == missing.json() == {"detail": "Not Found"}


def test_default_setting_is_off():
    from app.core.config import Settings

    assert Settings.model_fields["demo_extract_enabled"].default is False


def test_health_reports_the_flag(make):
    on, _ = make()
    off, _ = make(demo_extract_enabled=False)
    assert on.get("/health").json()["demo_extract"] is True
    assert off.get("/health").json()["demo_extract"] is False


# ---------------------------------------------------------------- /demo/extract
def test_extract_reads_the_pdf_text_layer_in_the_review_format(make):
    client, app = make()
    r = client.post("/demo/extract", files=pdf())
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["method"] == "text_layer" and len(j["observations"]) == 11 and j["collected_at"] == "2023-10-17"
    assert all(o["bbox"] for o in j["observations"]), "cada leitura traz a caixa para a tela de conferencia"
    assert j["pages"][0]["page"] == 1 and j["pages"][0]["url"].startswith("data:image/jpeg;base64,")
    assert set(j) >= {"document_id", "lab_name", "warnings", "observations", "pages"}  # mesmo contrato da revisao normal


def test_extract_never_uses_the_hosted_llm_even_if_a_key_exists(make):
    client, app = make(anthropic_api_key="sk-ant-teste-que-nao-pode-ser-usada")
    assert client.post("/demo/extract", files=pdf()).status_code == 200
    assert app.state.demo_caps.llm is None


def test_extract_photo_without_ocr_is_a_clear_error_not_a_crash(make):
    client, _ = make(ocr_enabled=False)
    r = client.post("/demo/extract", files={"file": ("foto.jpg", FOTO, "image/jpeg")})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "no_extractor"


def test_extract_validates_type_by_content_empty_and_size(make):
    client, _ = make()
    r = client.post("/demo/extract", files={"file": ("x.pdf", b"isto nao e um pdf", "application/pdf")})
    assert r.status_code == 415 and r.json()["detail"]["code"] == "unsupported_type"
    r = client.post("/demo/extract", files={"file": ("x.pdf", b"", "application/pdf")})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "empty_file"
    small, _ = make(max_upload_mb=0)
    r = small.post("/demo/extract", files=pdf())
    assert r.status_code == 413 and r.json()["detail"]["code"] == "file_too_large"


def test_extract_is_rate_limited_per_client(make):
    client, _ = make(demo_rate_per_minute=2)
    codes = [client.post("/demo/extract", files=pdf()).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    r = client.post("/demo/extract", files=pdf())
    assert r.json()["detail"]["code"] == "rate_limited"


def test_rate_limiter_window_slides():
    lim = RateLimiter(2)
    assert lim.allow("a", now=0) and lim.allow("a", now=10) and not lim.allow("a", now=20)
    assert lim.allow("b", now=20), "cada cliente tem o seu limite"
    assert lim.allow("a", now=61), "passados 60 s da primeira, libera de novo"
    assert not lim.allow("a", now=62)


# ---------------------------------------------------------------- /demo/normalize
def test_normalize_converts_to_the_canonical_unit_and_flags_by_the_labs_own_range(make):
    client, _ = make()
    r = client.post("/demo/normalize", json=BODY)
    assert r.status_code == 200, r.text
    j = r.json()
    assert (j["confirmed"], j["submitted"]) == (1, 1)
    p = j["points"][0]
    assert p["biomarker"] == "Glicemia de jejum" and p["normalization"] == "converted" and p["unit_canonical"] == "mg/dL"
    assert p["value"] == pytest.approx(99.09, abs=0.1) and p["raw_value"] == 5.5 and p["raw_unit"] == "mmol/L"
    assert p["ref_high"] == pytest.approx(99.09, abs=0.1) and p["flag"] == "in_range"  # limite exato conta como dentro
    assert p["category"] and p["collected_at"] == "2019-08-21" and p["lab_name"] == "Lakeside Medical Centre"


def test_normalize_flags_above_and_keeps_canonical_values_untouched(make):
    client, _ = make()
    body = {**BODY, "collected_at": "2026-09-28", "lab_name": "Diagnosticos Vita",
            "observations": [{"raw_name": "Glicemia de jejum", "value": 118, "unit": "mg/dL", "ref_low": 70, "ref_high": 110}]}  # fmt: skip
    p = client.post("/demo/normalize", json=body).json()["points"][0]
    assert p["flag"] == "above" and p["normalization"] == "canonical" and p["value"] == 118.0 and p["ref_high"] == 110.0


def test_normalize_unknown_name_stays_unmapped_but_is_still_flagged_by_its_range(make):
    client, _ = make()
    body = {**BODY, "observations": [{"raw_name": "Exame Inventado XYZ", "value": 9, "unit": "u/L", "ref_low": 1, "ref_high": 5}]}
    p = client.post("/demo/normalize", json=body).json()["points"][0]
    assert p["biomarker"] is None and p["normalization"] == "unmapped" and p["category"] is None and p["flag"] == "above"


def test_normalize_rejects_unknown_canonical_name_and_bad_input(make):
    client, _ = make()
    bad = {**BODY, "observations": [{**BODY["observations"][0], "canonical_name": "nao_existe"}]}
    r = client.post("/demo/normalize", json=bad)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "unknown_biomarker"
    assert client.post("/demo/normalize", json={**BODY, "collected_at": "2999-01-01"}).status_code == 422
    assert client.post("/demo/normalize", json={**BODY, "observations": []}).status_code == 422
    inverted = {**BODY, "observations": [{**BODY["observations"][0], "ref_low": 9, "ref_high": 1}]}
    assert client.post("/demo/normalize", json=inverted).status_code == 422


# ---------------------------------------------------------------- OCR de verdade (lento: roda com `pytest -m slow`)
@pytest.mark.slow
def test_extract_reads_a_photo_with_the_real_local_ocr(make):
    client, app = make(ocr_enabled=True)
    r = client.post("/demo/extract", files={"file": ("foto.jpg", FOTO, "image/jpeg")})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["method"] == "ocr" and len(j["observations"]) >= 8
    assert j["pages"] and j["pages"][0]["url"].startswith("data:image/jpeg;base64,")
    assert any(o["bbox"] for o in j["observations"])
    assert app.state.demo_caps.llm is None
