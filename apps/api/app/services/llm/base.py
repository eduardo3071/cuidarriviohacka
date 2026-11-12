from collections.abc import Sequence
from dataclasses import dataclass
from typing import Generic, Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """Falha ao obter uma resposta estruturada (credencial, rede, recusa, truncamento).

    A mensagem e segura para mostrar ao usuario/log: nunca contem chave de API.
    """


@dataclass(frozen=True)
class Image:
    data: bytes
    media_type: str  # image/png | image/jpeg | image/webp | image/gif


@dataclass
class LLMResult(Generic[T]):
    parsed: T
    input_tokens: int
    output_tokens: int
    model: str


class LLMClient(Protocol):
    """Interface unica de IA do backend. Cada provedor entra como um adaptador."""

    model: str

    def parse(
        self,
        *,
        system: str,
        user_text: str,
        images: Sequence[Image] = (),
        schema: type[T],
    ) -> LLMResult[T]: ...
