from app.core.config import Settings

from .anthropic_client import AnthropicLLM
from .base import LLMClient


def get_llm_client(settings: Settings) -> LLMClient:
    provider = settings.llm_provider.lower()
    if provider == "anthropic":
        return AnthropicLLM(model=settings.llm_model or None, api_key=settings.anthropic_api_key or None)
    raise ValueError(
        f"LLM_PROVIDER={settings.llm_provider!r} nao implementado. "
        "Hoje so existe o adaptador 'anthropic'; outros provedores entram como novos adaptadores de LLMClient."
    )
