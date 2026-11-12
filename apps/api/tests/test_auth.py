"""Verificacao do JWT do Supabase com chaves geradas aqui (nenhuma chave/token real)."""
import base64
import hashlib
import hmac
import json
import time
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from app.core.auth import AuthError, AuthUnavailable, JwtVerifier

ISS = "https://proj.supabase.co/auth/v1"
PRIV = ec.generate_private_key(ec.SECP256R1())
OTHER = ec.generate_private_key(ec.SECP256R1())
PUB = PRIV.public_key()
PUB_PEM = PUB.public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
USER = uuid4()


class FakeJwks:
    def __init__(self, error=None):
        self.error = error

    def get_signing_key_from_jwt(self, token):
        if self.error:
            raise self.error
        return SimpleNamespace(key=PUB)


def token(over=None, key=PRIV, drop=()):
    claims = {"sub": str(USER), "aud": "authenticated", "iss": ISS, "exp": int(time.time()) + 600, "email": "a@b.co"}
    claims.update(over or {})
    for k in drop:
        claims.pop(k)
    return jwt.encode(claims, key, algorithm="ES256", headers={"kid": "k1"})


def verifier(error=None):
    return JwtVerifier("https://unused", ISS, jwk_client=FakeJwks(error))


def b64(d: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()


def test_valid_token_gives_user():
    u = verifier().verify(token())
    assert u.id == USER and u.email == "a@b.co"


@pytest.mark.parametrize(
    "over",
    [
        {"exp": int(time.time()) - 300},  # expirado (alem da tolerancia de relogio)
        {"aud": "anon"},  # outro publico
        {"iss": "https://outro.supabase.co/auth/v1"},  # outro projeto
        {"sub": "nao-e-uuid"},
    ],
)
def test_bad_claims_are_rejected(over):
    with pytest.raises(AuthError):
        verifier().verify(token(over))


@pytest.mark.parametrize("drop", ["exp", "sub", "aud", "iss"])
def test_required_claims_must_exist(drop):
    with pytest.raises(AuthError):
        verifier().verify(token(drop=(drop,)))


def test_signature_from_another_key_is_rejected():
    with pytest.raises(AuthError):
        verifier().verify(token(key=OTHER))


def test_alg_confusion_hs256_signed_with_public_key_is_rejected():
    """Ataque classico: assinar HS256 usando a chave PUBLICA como segredo."""
    head, body = b64({"alg": "HS256", "typ": "JWT", "kid": "k1"}), b64(
        {"sub": str(USER), "aud": "authenticated", "iss": ISS, "exp": int(time.time()) + 600}
    )
    sig = base64.urlsafe_b64encode(hmac.new(PUB_PEM, f"{head}.{body}".encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    with pytest.raises(AuthError):
        verifier().verify(f"{head}.{body}.{sig}")


def test_alg_none_is_rejected():
    forged = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': str(USER), 'aud': 'authenticated', 'iss': ISS, 'exp': int(time.time()) + 600})}."
    with pytest.raises(AuthError):
        verifier().verify(forged)


@pytest.mark.parametrize("bad", ["", "lixo", "a.b.c"])
def test_garbage_tokens(bad):
    with pytest.raises(AuthError):
        verifier().verify(bad)


def test_jwks_unreachable_is_unavailable_not_unauthorized():
    with pytest.raises(AuthUnavailable):
        verifier(jwt.PyJWKClientConnectionError("rede")).verify(token())


def test_error_message_never_echoes_the_token():
    t = token({"exp": int(time.time()) - 300})
    with pytest.raises(AuthError) as ei:
        verifier().verify(t)
    assert t not in str(ei.value)


# ---- desvio de relogio: bug real achado ao vivo (Supabase ~1,5 s a frente do notebook)
def test_token_issued_slightly_in_the_future_is_accepted():
    """iat alguns segundos a frente do nosso relogio nao pode derrubar um login valido."""
    now = int(time.time())
    assert verifier().verify(token({"iat": now + 20, "nbf": now + 20})).id == USER


def test_clock_skew_tolerance_has_limits():
    now = int(time.time())
    with pytest.raises(AuthError):
        verifier().verify(token({"iat": now + 300}))  # muito a frente: nao e desvio, e problema
    with pytest.raises(AuthError):
        verifier().verify(token({"exp": now - 120}))  # expirado ha mais que a tolerancia
    assert verifier().verify(token({"exp": now - 10})).id == USER  # dentro da tolerancia (documentado)
