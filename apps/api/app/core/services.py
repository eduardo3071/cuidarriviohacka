"""Container das dependencias de infraestrutura, montado a partir das variaveis de ambiente."""
from dataclasses import dataclass
from pathlib import Path

from app.repositories.base import DocumentRepository
from app.services.extraction.router import Capabilities
from app.services.llm.factory import get_llm_client
from app.services.normalization.ontology import load_ontology
from app.storage.base import Storage

from .auth import JwtVerifier
from .config import Settings


class ServiceConfigError(RuntimeError):
    """Configuracao faltando. A mensagem lista QUAIS variaveis (nunca valores)."""


@dataclass
class Services:
    repo: DocumentRepository
    storage: Storage
    caps: Capabilities
    verifier: JwtVerifier
    max_upload_bytes: int = 15 * 1024 * 1024


def build_services(s: Settings) -> Services:
    missing = [
        name
        for name, value in (
            ("SUPABASE_URL", s.supabase_url),
            ("SUPABASE_SECRET_KEY", s.supabase_secret_key),
            ("DATABASE_URL", s.database_url),
        )
        if not value
    ]
    if missing:
        raise ServiceConfigError("Variaveis de ambiente ausentes: " + ", ".join(missing))

    from app.repositories.sql import SqlRepository, make_engine
    from app.storage.supabase import SupabaseStorage

    base = s.supabase_url.rstrip("/")
    llm = get_llm_client(s) if s.anthropic_api_key else None
    return Services(
        repo=SqlRepository(make_engine(s.database_url)),
        storage=SupabaseStorage(base, s.supabase_secret_key, s.storage_bucket),
        caps=Capabilities(load_ontology(Path(s.ontology_dir)), ocr_enabled=s.ocr_enabled, llm=llm),
        verifier=JwtVerifier(f"{base}/auth/v1/.well-known/jwks.json", issuer=f"{base}/auth/v1"),
        max_upload_bytes=s.max_upload_mb * 1024 * 1024,
    )
