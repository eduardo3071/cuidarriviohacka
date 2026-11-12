"""Storage do Supabase via API REST (httpx), autenticado com a chave SECRETA do projeto (so no backend).

Segue a API REST do Supabase Storage (POST/GET /storage/v1/object/..., POST /object/sign/...).
Os testes verificam os pedidos montados com um transporte simulado; `scripts/live_check.py --live`
confere contra o projeto real.
"""
from urllib.parse import quote

import httpx

from .base import StorageError


def auth_headers(key: str) -> dict[str, str]:
    """Cabecalhos de autenticacao do backend no Supabase.

    Chave nova (`sb_secret_...`): NAO e um JWT, entao vai SO em `apikey`. Mandar tambem em
    `Authorization: Bearer` e o erro tipico: o gateway so aceita se for igual ao apikey e o servico
    a rejeita por nao ser um JWT. Chave legada (JWT `service_role`): `apikey` + `Authorization`.
    Obs.: a chave secreta nova e recusada (HTTP 401) se o User-Agent parecer um navegador.
    """
    if key.startswith("sb_"):
        return {"apikey": key}
    return {"apikey": key, "Authorization": f"Bearer {key}"}


class SupabaseStorage:
    def __init__(self, url: str, secret_key: str, bucket: str, client: httpx.Client | None = None) -> None:
        self._base = f"{url.rstrip('/')}/storage/v1"
        self._bucket = bucket
        self._client = client or httpx.Client(timeout=30.0)
        self._headers = auth_headers(secret_key)

    def _object_url(self, path: str) -> str:
        return f"{self._base}/object/{self._bucket}/{quote(path, safe='/')}"

    def _check(self, r: httpx.Response, what: str) -> None:
        if r.status_code >= 400:  # nao inclui corpo/cabecalhos: podem ecoar dados sensiveis
            raise StorageError(f"{what} falhou (HTTP {r.status_code})")

    def put(self, path: str, data: bytes, content_type: str) -> None:
        try:
            r = self._client.post(
                self._object_url(path), content=data, headers={**self._headers, "Content-Type": content_type, "x-upsert": "true"}
            )
        except httpx.HTTPError as e:
            raise StorageError("upload ao storage falhou (rede)") from e
        self._check(r, "upload ao storage")

    def get(self, path: str) -> bytes:
        try:
            r = self._client.get(self._object_url(path), headers=self._headers)
        except httpx.HTTPError as e:
            raise StorageError("download do storage falhou (rede)") from e
        self._check(r, "download do storage")
        return r.content

    def signed_url(self, path: str, expires_in: int = 600) -> str:
        try:
            r = self._client.post(
                f"{self._base}/object/sign/{self._bucket}/{quote(path, safe='/')}",
                json={"expiresIn": expires_in},
                headers=self._headers,
            )
        except httpx.HTTPError as e:
            raise StorageError("assinatura de URL falhou (rede)") from e
        self._check(r, "assinatura de URL")
        signed = r.json().get("signedURL")
        if not signed:
            raise StorageError("resposta de assinatura sem signedURL")
        return f"{self._base}{signed}"
