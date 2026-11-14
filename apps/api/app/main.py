import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import demo, documents
from app.core.config import get_settings
from app.core.services import ServiceConfigError, Services, build_services

log = logging.getLogger("rivio")


def create_app(services: Services | None = None) -> FastAPI:
    """`services` injetado nos testes; em producao e montado das variaveis de ambiente."""
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            if getattr(app.state, "services", None) is None:
                app.state.services = build_services(settings)
            # jobs 'running' de uma execucao anterior que caiu no meio nunca terminariam sozinhos
            n = app.state.services.repo.fail_stale_jobs(settings.stale_job_minutes)
            if n:
                log.warning("%d job(s) interrompido(s) marcados como falhos", n)
        except ServiceConfigError as e:
            log.warning("API subindo sem banco/storage configurados: %s", e)
        except Exception:  # noqa: BLE001  falha de banco no boot nao pode derrubar a API
            log.exception("falha ao preparar servicos no boot")
        yield

    app = FastAPI(title="Rivio Hub de Saude API", version="0.2.0", lifespan=lifespan)
    app.state.services = services
    app.state.settings = settings  # as rotas de demonstracao leem o liga/desliga daqui (e os testes o trocam)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(documents.router)
    app.include_router(demo.router)  # 404 enquanto DEMO_EXTRACT_ENABLED=false

    @app.get("/health", tags=["infra"])
    async def health() -> dict:
        s = app.state.settings  # a mesma fonte que as rotas de demonstracao usam
        return {
            "status": "ok",
            "ocr_enabled": s.ocr_enabled,
            "llm_configured": bool(s.anthropic_api_key),
            "demo_extract": s.demo_extract_enabled,
        }

    return app


app = create_app()
