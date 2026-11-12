from fastapi import HTTPException


def api_error(http_status: int, code: str, message: str, **extra) -> HTTPException:
    """Erro com corpo estavel: {"detail": {"code": "...", "message": "...", ...}}.
    O front decide pelo `code`; `message` e para mostrar ao usuario. `extra` vai no detalhe
    (por isso o parametro HTTP nao se chama `status`: `status` e um detalhe comum)."""
    return HTTPException(status_code=http_status, detail={"code": code, "message": message, **extra})
