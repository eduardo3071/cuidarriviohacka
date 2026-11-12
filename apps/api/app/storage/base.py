from typing import Protocol


class StorageError(RuntimeError):
    """Falha ao falar com o storage (rede, permissao, objeto ausente). Mensagem segura para log/usuario."""


class Storage(Protocol):
    def put(self, path: str, data: bytes, content_type: str) -> None:
        """Grava (sobrescreve): caminhos sao enderecados por conteudo, entao regravar e inofensivo."""

    def get(self, path: str) -> bytes: ...

    def signed_url(self, path: str, expires_in: int = 600) -> str:
        """URL temporaria de leitura para o front mostrar a pagina (o bucket e privado)."""
