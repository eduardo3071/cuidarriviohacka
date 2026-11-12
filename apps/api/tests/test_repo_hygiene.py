"""Higiene do repositorio: segredos nunca no arquivo-modelo (que vai para o git).

Existe porque aconteceu duas vezes de colarem a DATABASE_URL e a chave secreta no .env.example.
Este teste NUNCA imprime o valor encontrado: so diz qual variavel esta suspeita.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

SECRET_VALUE = re.compile(
    r"sb_secret_[A-Za-z0-9_\-]{8,}"  # chave secreta nova do Supabase
    r"|eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"  # qualquer JWT (anon/service_role legados)
    r"|sk-ant-[A-Za-z0-9_\-]{8,}"  # chave da API Anthropic
)
URL_WITH_PASSWORD = re.compile(r"^\w[\w+]*://[^:/\s]+:([^@\s]+)@")


def _assignments(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def test_env_example_has_no_secrets():
    suspects = []
    for name, value in _assignments(ROOT / ".env.example").items():
        if SECRET_VALUE.search(value):
            suspects.append(name)
        m = URL_WITH_PASSWORD.match(value)
        if m and not (m.group(1).startswith("<") and m.group(1).endswith(">")):
            suspects.append(name)  # URL com senha de verdade (so o placeholder <SENHA> e aceito)
    assert not suspects, f"segredo no .env.example (variaveis: {sorted(set(suspects))}): mova para o .env"


def test_env_is_ignored_by_git_but_the_example_is_not():
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert ".env" in ignore
    assert "!.env.example" in ignore


def test_the_detector_itself_catches_the_two_mistakes():
    """Garante que o teste acima nao e um no-op."""
    assert SECRET_VALUE.search("sb_secret_" + "A" * 24)
    assert SECRET_VALUE.search("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.assinatura")
    assert URL_WITH_PASSWORD.match("postgresql://postgres.ref:minhasenha@host:6543/postgres").group(1) == "minhasenha"
    assert URL_WITH_PASSWORD.match("postgresql+psycopg://u:<SENHA>@<HOST>:6543/db").group(1) == "<SENHA>"
