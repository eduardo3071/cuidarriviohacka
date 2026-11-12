"""Verificacao do JWT do Supabase Auth (assimetrico, ES256) pela chave publica do JWKS do projeto.

Nao ha segredo compartilhado: o JWKS e publico. Aceita so ES256/RS256 (nunca HS256/none), o que
fecha o ataque de confusao de algoritmo (token HS256 assinado com a chave publica como segredo).
"""
from dataclasses import dataclass
from uuid import UUID

import jwt


class AuthError(Exception):
    """Token ausente, invalido, expirado ou de outro projeto. Mensagem segura (nao ecoa o token)."""


class AuthUnavailable(Exception):
    """Nao foi possivel buscar as chaves publicas (rede)."""


@dataclass(frozen=True)
class AuthUser:
    id: UUID
    email: str | None = None


class JwtVerifier:
    ALGORITHMS = ["ES256", "RS256"]
    # Tolerancia a desvio de relogio entre o servidor do Auth e esta maquina. Sem ela, um token recem-emitido
    # e rejeitado (ImmatureSignatureError) quando o `iat` cai alguns segundos a frente do nosso relogio:
    # medido ao vivo, o Supabase estava ~1,5 s a frente de um notebook. Contrapartida: um token expirado ha
    # menos de LEEWAY segundos ainda vale. 30 s e bem menor que a vida de uma sessao.
    LEEWAY_SECONDS = 30

    def __init__(self, jwks_url: str, issuer: str, audience: str = "authenticated", jwk_client=None) -> None:
        self._issuer, self._audience = issuer, audience
        self._jwks = jwk_client or jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600, timeout=10)

    def verify(self, token: str) -> AuthUser:
        if not token:
            raise AuthError("token ausente")
        try:
            key = self._jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key,
                algorithms=self.ALGORITHMS,
                audience=self._audience,
                issuer=self._issuer,
                leeway=self.LEEWAY_SECONDS,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
        except jwt.PyJWKClientConnectionError as e:
            raise AuthUnavailable("nao foi possivel obter as chaves de autenticacao") from e
        except jwt.PyJWTError as e:
            raise AuthError(f"token invalido ({type(e).__name__})") from e
        try:
            return AuthUser(id=UUID(claims["sub"]), email=claims.get("email"))
        except (ValueError, KeyError) as e:
            raise AuthError("token sem usuario valido") from e
