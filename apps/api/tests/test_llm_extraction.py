"""Camada de LLM + extrator com IA, SEM chamar a API (clientes falsos)."""
import base64
from pathlib import Path
from types import SimpleNamespace

import anthropic
import pytest

from app.services.extraction import llm_extractor
from app.services.extraction.llm_extractor import LLMExtraction, LLMObservation
from app.services.llm.anthropic_client import AnthropicLLM
from app.services.llm.base import Image, LLMError, LLMResult

EXAMS = Path(__file__).resolve().parents[3] / "data" / "synthetic" / "marta" / "exams"


def _extraction(*obs: LLMObservation, lab="Lab X", date="2023-10-17") -> LLMExtraction:
    return LLMExtraction(lab_name=lab, collected_at=date, observations=list(obs))


GLU = LLMObservation(raw_name="Glicose em jejum", value=106, unit="mg/dL", ref_low=70, ref_high=99, ref_text="70 - 99")


class FakeLLM:
    model = "fake"

    def __init__(self, per_call: list[LLMExtraction]):
        self.per_call = per_call
        self.calls: list[dict] = []

    def parse(self, *, system, user_text, images=(), schema):
        self.calls.append({"system": system, "user_text": user_text, "images": list(images), "schema": schema})
        return LLMResult(parsed=self.per_call[len(self.calls) - 1], input_tokens=100, output_tokens=20, model="fake")


# ---------------------------------------------------------------- extrator
def test_pdf_text_sends_page_text_and_maps_result():
    llm = FakeLLM([_extraction(GLU)])
    out = llm_extractor.extract_pdf_text(llm, EXAMS / "aurora_2023.pdf")
    assert len(llm.calls) == 1 and llm.calls[0]["images"] == []
    assert "Glicose em jejum" in llm.calls[0]["user_text"]
    assert llm.calls[0]["schema"] is LLMExtraction
    obs = out.result.observations
    assert len(obs) == 1 and obs[0].raw_name == "Glicose em jejum" and obs[0].page == 1
    assert obs[0].confidence is None, "o extrator nao estima confianca: nao pode fingir 1.0"
    assert out.result.lab_name == "Lab X" and out.result.collected_at == "2023-10-17"
    assert (out.input_tokens, out.output_tokens, out.calls) == (100, 20, 1)


def test_images_one_call_per_page_with_page_numbers():
    llm = FakeLLM([_extraction(GLU), _extraction(GLU, lab=None, date=None)])
    imgs = [Image(b"a", "image/png"), Image(b"b", "image/png")]
    out = llm_extractor.extract_images(llm, imgs)
    assert [c["images"][0].data for c in llm.calls] == [b"a", b"b"]
    assert [o.page for o in out.result.observations] == [1, 2]
    assert out.result.lab_name == "Lab X", "lab/data vem da primeira pagina que informar"


def test_render_pdf_pages_returns_png():
    pages = llm_extractor.render_pdf_pages(EXAMS / "aurora_2023.pdf")
    assert len(pages) == 1 and pages[0].media_type == "image/png"
    assert pages[0].data.startswith(b"\x89PNG")


def test_image_from_file_media_type():
    img = llm_extractor.image_from_file(EXAMS / "aurora_2023_foto.jpg")
    assert img.media_type == "image/jpeg" and img.data[:3] == b"\xff\xd8\xff"
    with pytest.raises(ValueError):
        llm_extractor.image_from_file(EXAMS / "aurora_2023.pdf")


def test_prompt_treats_document_as_untrusted():
    assert "untrusted" in llm_extractor.SYSTEM_PROMPT


# ---------------------------------------------------------------- adaptador Anthropic
class FakeMessages:
    def __init__(self, response=None, error=None):
        self.response, self.error, self.kwargs = response, error, None

    def parse(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return self.response


def _resp(parsed, stop="end_turn", category=None):
    return SimpleNamespace(
        parsed_output=parsed,
        stop_reason=stop,
        stop_details=SimpleNamespace(category=category),
        usage=SimpleNamespace(input_tokens=11, output_tokens=7),
    )


def _llm(messages: FakeMessages) -> AnthropicLLM:
    return AnthropicLLM(client=SimpleNamespace(messages=messages))


def test_anthropic_request_shape_and_result():
    msgs = FakeMessages(_resp(_extraction(GLU)))
    out = _llm(msgs).parse(
        system="SYS", user_text="TXT", images=[Image(b"\x89PNG", "image/png")], schema=LLMExtraction
    )
    k = msgs.kwargs
    assert k["model"] == "claude-opus-5-5" and k["output_format"] is LLMExtraction
    assert k["system"] == "SYS" and k["max_tokens"] >= 4096
    for removed in ("temperature", "top_p", "top_k", "thinking", "tool_choice"):
        assert removed not in k, f"{removed} e rejeitado/removido no modelo padrao"
    content = k["messages"][0]["content"]
    assert content[0]["type"] == "image" and content[-1] == {"type": "text", "text": "TXT"}
    assert content[0]["source"] == {
        "type": "base64",
        "media_type": "image/png",
        "data": base64.standard_b64encode(b"\x89PNG").decode(),
    }
    assert (out.input_tokens, out.output_tokens) == (11, 7) and out.parsed.observations[0].value == 106


def test_anthropic_model_is_configurable():
    msgs = FakeMessages(_resp(_extraction(GLU)))
    AnthropicLLM(model="claude-sonnet-5-5", client=SimpleNamespace(messages=msgs)).parse(
        system="s", user_text="t", schema=LLMExtraction
    )
    assert msgs.kwargs["model"] == "claude-sonnet-5-5"


@pytest.mark.parametrize(
    "resp,needle",
    [
        (_resp(None, stop="refusal", category="cyber"), "recusou"),
        (_resp(None, stop="max_tokens"), "truncada"),
        (_resp(None), "estruturada"),
    ],
)
def test_anthropic_bad_stop_reasons_raise_llm_error(resp, needle):
    with pytest.raises(LLMError, match=needle):
        _llm(FakeMessages(resp)).parse(system="s", user_text="t", schema=LLMExtraction)


def test_anthropic_api_errors_become_llm_error_without_leaking_key():
    req = SimpleNamespace(method="POST", url="https://api.anthropic.com/v1/messages")
    resp401 = SimpleNamespace(status_code=401, headers={}, request=req)
    err = anthropic.AuthenticationError("invalid x-api-key sk-ant-SECRET", response=resp401, body=None)
    with pytest.raises(LLMError) as ei:
        _llm(FakeMessages(error=err)).parse(system="s", user_text="t", schema=LLMExtraction)
    assert "sk-ant" not in str(ei.value)


def test_no_credentials_gives_friendly_error(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    llm = AnthropicLLM()  # cliente real, sem credencial: nao pode chamar a rede
    with pytest.raises(LLMError, match="credencial|Chave"):
        llm.parse(system="s", user_text="t", schema=LLMExtraction)
