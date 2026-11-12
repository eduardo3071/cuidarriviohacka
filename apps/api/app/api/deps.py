import threading
from uuid import UUID

from fastapi import Depends, Request

from app.core.auth import AuthError, AuthUnavailable, AuthUser
from app.core.config import get_settings
from app.core.services import ServiceConfigError, Services, build_services

from .errors import api_error

_build_lock = threading.Lock()


def get_services(request: Request) -> Services:
    svc = getattr(request.app.state, "services", None)
    if svc is None:
        with _build_lock:
            svc = getattr(request.app.state, "services", None)
            if svc is None:
                try:
                    svc = build_services(get_settings())
                except ServiceConfigError as e:
                    raise api_error(503, "service_unavailable", str(e)) from e
                request.app.state.services = svc
    return svc


def current_user(request: Request, svc: Services = Depends(get_services)) -> AuthUser:
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        e = api_error(401, "unauthenticated", "Envie o cabecalho Authorization: Bearer <token>.")
        e.headers = {"WWW-Authenticate": "Bearer"}
        raise e
    try:
        return svc.verifier.verify(token.strip())
    except AuthError as err:
        e = api_error(401, "invalid_token", "Token invalido ou expirado.")
        e.headers = {"WWW-Authenticate": "Bearer"}
        raise e from err
    except AuthUnavailable as err:
        raise api_error(503, "auth_unavailable", "Autenticacao indisponivel no momento.") from err


def current_patient(user: AuthUser = Depends(current_user), svc: Services = Depends(get_services)) -> UUID:
    """O paciente e SEMPRE derivado do token: nunca de um parametro da requisicao."""
    patient_id = svc.repo.get_patient_id_for_user(user.id)
    if patient_id is None:
        raise api_error(403, "no_patient_profile", "Este usuario nao tem perfil de paciente.")
    return patient_id
