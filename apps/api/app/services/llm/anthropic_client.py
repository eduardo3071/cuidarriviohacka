import base64
from collections.abc import Sequence

import anthropic

from .base import Image, LLMError, LLMResult, T


class AnthropicLLM:
    """Adaptador da API Claude (SDK oficial). Saida estruturada via messages.parse().

    Notas do modelo padrao (claude-opus-5-5): pensamento sempre ligado e esforco
    padrao `medium`; `tool_choice` forcado nao e aceito, por isso a saida
    estruturada usa output_format (nao tool use).
    """

    DEFAULT_MODEL = "claude-opus-5-5"

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        client: anthropic.Anthropic | None = None,
        max_tokens: int = 16000,
    ) -> None:
        self.model = model or self.DEFAULT_MODEL
        self.max_tokens = max_tokens
        # api_key=None -> o SDK resolve ANTHROPIC_API_KEY / perfil `ant auth login`
        self._client = client or anthropic.Anthropic(api_key=api_key or None)

    def parse(
        self,
        *,
        system: str,
        user_text: str,
        images: Sequence[Image] = (),
        schema: type[T],
    ) -> LLMResult[T]:
        content: list[dict] = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": im.media_type,
                    "data": base64.standard_b64encode(im.data).decode("ascii"),
                },
            }
            for im in images
        ]
        content.append({"type": "text", "text": user_text})

        try:
            resp = self._client.messages.parse(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[{"role": "user", "content": content}],
                output_format=schema,
            )
        except anthropic.AuthenticationError as e:
            raise LLMError("Chave da API Anthropic invalida ou sem permissao.") from e
        except anthropic.RateLimitError as e:
            raise LLMError("Limite de requisicoes da API atingido; tente de novo em instantes.") from e
        except anthropic.APIConnectionError as e:
            raise LLMError("Sem conexao com a API Anthropic.") from e
        except anthropic.APIStatusError as e:
            raise LLMError(f"Erro da API Anthropic (HTTP {e.status_code}): {e.message}") from e
        except TypeError as e:  # o SDK levanta TypeError quando nao ha credencial nenhuma
            if "authentication" in str(e).lower():
                raise LLMError(
                    "Nenhuma credencial Anthropic: defina ANTHROPIC_API_KEY no .env (nunca no codigo)."
                ) from e
            raise

        if resp.stop_reason == "refusal":
            category = getattr(getattr(resp, "stop_details", None), "category", None)
            raise LLMError(f"O modelo recusou a requisicao (categoria: {category}).")
        if resp.stop_reason == "max_tokens":
            raise LLMError("Resposta truncada (max_tokens); documento grande demais para uma chamada.")
        if resp.parsed_output is None:
            raise LLMError("O modelo nao devolveu saida estruturada valida.")

        return LLMResult(
            parsed=resp.parsed_output,
            input_tokens=resp.usage.input_tokens,
            output_tokens=resp.usage.output_tokens,
            model=self.model,
        )
