"""Confere que o bundle do front (apps/web/dist) nao vazou nenhum segredo. Nunca imprime valores.

    apps/api/.venv/Scripts/python.exe scripts/check_bundle.py

Procura (1) os VALORES reais de cada segredo do .env da raiz (tudo que nao e VITE_ e parece segredo) e
(2) padroes de segredo (sb_secret_, sk-ant-, senha em URL de banco). A chave publicavel (sb_publishable_) e publica de proposito.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "apps" / "web" / "dist"
SECRET_NAME = re.compile(r"(SECRET|PASSWORD|API_KEY|TOKEN|DATABASE_URL|SERVICE_ROLE)", re.I)
PATTERNS = {
    "chave secreta do Supabase (sb_secret_)": re.compile(rb"sb_secret_[A-Za-z0-9_\-]{8,}"),
    "chave da Anthropic (sk-ant-)": re.compile(rb"sk-ant-[A-Za-z0-9_\-]{8,}"),
    "URL de banco com senha": re.compile(rb"postgres(?:ql)?(?:\+\w+)?://[^\s:@/]+:[^\s@/]{4,}@"),
}


def env_secret_values() -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    env = ROOT / ".env"
    if not env.exists():
        return out
    for line in env.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
        if not m:
            continue
        name, value = m.group(1), m.group(2).strip("'\"")
        if name.startswith("VITE_") or not SECRET_NAME.search(name) or len(value) < 8:
            continue
        out[name] = value.encode()
        # a senha dentro de uma URL de banco tambem nao pode aparecer sozinha
        pw = re.match(r"^[a-z+]+://[^:]+:([^@]+)@", value)
        if pw and len(pw.group(1)) >= 8:
            out[f"{name} (senha)"] = pw.group(1).encode()
    return out


def main() -> int:
    if not DIST.exists():
        print("apps/web/dist nao existe: rode `npm run build` em apps/web primeiro.")
        return 2
    files = [p for p in DIST.rglob("*") if p.is_file()]
    if not files:
        print("dist vazio.")
        return 2
    secrets = env_secret_values()
    problems: list[str] = []
    for f in files:
        data = f.read_bytes()
        for name, value in secrets.items():
            if value in data:
                problems.append(f"{f.relative_to(DIST)}: contem o valor de {name}")
        for label, rx in PATTERNS.items():
            if rx.search(data):
                problems.append(f"{f.relative_to(DIST)}: padrao de {label}")
    if problems:
        print("VAZAMENTO NO BUNDLE:")
        for p in problems:
            print(" -", p)
        return 1
    print(f"OK: {len(files)} arquivos de dist conferidos contra {len(secrets)} segredos do .env e {len(PATTERNS)} padroes; nenhum vazamento.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
