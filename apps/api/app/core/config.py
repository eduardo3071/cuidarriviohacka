from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env na raiz do repositorio (funciona rodando de qualquer pasta) ou na pasta atual
_ROOT_ENV = Path(__file__).resolve().parents[4] / ".env"
_DEFAULT_ONTOLOGY = Path(__file__).resolve().parents[4] / "data" / "ontology"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(_ROOT_ENV, ".env"), extra="ignore", populate_by_name=True)

    supabase_url: str = ""
    # Chave secreta (sb_secret_...): so no backend; ignora RLS, entao SEMPRE conferir o dono em codigo.
    # SUPABASE_SERVICE_ROLE_KEY (nome antigo, chave JWT legada) continua aceito como alternativa.
    supabase_secret_key: str = Field(default="", validation_alias=AliasChoices("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"))
    database_url: str = ""  # postgresql+psycopg://... (pooler, porta 6543)
    storage_bucket: str = "documents"

    cors_origins: str = "http://localhost:5173"

    ontology_dir: str = str(_DEFAULT_ONTOLOGY)  # na imagem Docker: /app/data/ontology
    max_upload_mb: int = 15
    stale_job_minutes: int = 15  # job 'running' parado alem disso e dado como interrompido

    # extracao
    ocr_enabled: bool = False  # OCR local: ~400 MB e 10+ s/pagina; so onde o servidor aguenta
    llm_provider: str = "anthropic"
    llm_model: str = ""  # vazio -> padrao do adaptador (claude-opus-5-5)
    anthropic_api_key: str = ""  # so no backend/.env; nunca no front nem no git

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
