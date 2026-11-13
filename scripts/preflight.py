"""Pre-voo da demonstracao: confere, ANTES de subir, o que vai funcionar e o que vai cair no plano B.

    apps/api/.venv/Scripts/python.exe scripts/preflight.py            # tudo
    apps/api/.venv/Scripts/python.exe scripts/preflight.py --offline  # so o que e local (sem rede)

Cada linha e OK, AVISO (a demo roda, mas algo cai no plano B) ou FALHA (nao sobe). Nunca imprime chave, token ou senha.
Codigo de saida: 1 se houver FALHA, senao 0.
"""
import shutil
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

import httpx  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from app.core.config import get_settings  # noqa: E402

OFFLINE = "--offline" in sys.argv
S = get_settings()
ENV = {}  # variaveis VITE_ (o front le o mesmo .env da raiz)
_env_file = ROOT / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        if "=" in _line and not _line.lstrip().startswith("#"):
            k, v = _line.split("=", 1)
            ENV[k.strip()] = v.strip().strip("'\"")

_url = make_url(S.database_url) if S.database_url else None
SECRETS = [v for v in (S.supabase_secret_key, S.anthropic_api_key, _url.password if _url else None) if v]
rows: list[tuple[str, str, str]] = []


def scrub(msg: str) -> str:
    for sec in SECRETS:
        msg = msg.replace(sec, "***")
    return msg


def report(status: str, name: str, detail: str = "") -> None:
    rows.append((status, name, detail))
    print(f"  {status:<5} {name}" + (f"  - {scrub(detail)}" if detail else ""))


def port_busy(port: int) -> bool:
    # o Vite escuta em "localhost", que no Windows costuma ser ::1 (IPv6): conferir os dois enderecos
    for fam, addr in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        with socket.socket(fam) as s:
            s.settimeout(0.5)
            if s.connect_ex((addr, port)) == 0:
                return True
    return False


# ---------------------------------------------------------------- local (sem rede)
def local_checks() -> None:
    print("Local")
    node = shutil.which("node")
    if node:
        v = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
        report("OK", "Node", v)
    else:
        report("FALHA", "Node", "nao encontrado: instale o Node 20+ para o front")
    report("OK" if (ROOT / "apps/web/node_modules").exists() else "FALHA", "Dependencias do front", "rode `npm install` em apps/web" if not (ROOT / "apps/web/node_modules").exists() else "")
    demo = ROOT / "apps/web/src/demo/marta.json"
    report("OK" if demo.exists() else "FALHA", "Dados da demonstracao (plano B offline)", "" if demo.exists() else "rode scripts/build_demo_data.py")

    for port, who in ((8000, "API"), (5173, "front")):
        report("AVISO" if port_busy(port) else "OK", f"Porta {port} ({who})", "ja em uso: feche o que esta nela, ou ignore se for esta mesma demo" if port_busy(port) else "livre")

    try:
        import cv2  # noqa: F401
        import rapidocr  # noqa: F401

        ocr_libs = True
    except Exception:  # noqa: BLE001
        ocr_libs = False
    if S.ocr_enabled and not ocr_libs:
        report("AVISO", "OCR local", "OCR_ENABLED=true mas OpenCV/RapidOCR nao importam: foto de laudo falha")
    elif S.ocr_enabled:
        report("OK", "OCR local", "ligado (cerca de 400 MB de RAM e 10+ s por pagina; o 1o uso baixa/aquece modelos)")
    else:
        report("AVISO", "OCR local", "desligado (OCR_ENABLED=false): so PDFs com texto e a IA; foto de laudo nao e lida")


# ---------------------------------------------------------------- configuracao e nuvem
def cloud_checks() -> bool:
    """Devolve True se a nuvem esta utilizavel (login e banco)."""
    print("Configuracao (.env da raiz)")
    if not _env_file.exists():
        report("FALHA", ".env", "nao existe: copie .env.example para .env e preencha")
        return False
    need = {
        "SUPABASE_URL": S.supabase_url,
        "SUPABASE_SECRET_KEY": S.supabase_secret_key,
        "DATABASE_URL": S.database_url,
        "VITE_SUPABASE_URL": ENV.get("VITE_SUPABASE_URL", ""),
        "VITE_SUPABASE_PUBLISHABLE_KEY": ENV.get("VITE_SUPABASE_PUBLISHABLE_KEY", ""),
    }
    missing = [k for k, v in need.items() if not v]
    if missing:
        report("FALHA", "Variaveis obrigatorias", "faltam: " + ", ".join(missing))
        return False
    report("OK", "Variaveis obrigatorias", "5 de 5 preenchidas")
    report("OK" if S.anthropic_api_key else "AVISO", "Chave da IA (Anthropic)", "" if S.anthropic_api_key else "vazia: upload de laudo nao usa a IA (so texto do PDF e OCR)")

    print("Nuvem (Supabase)")
    try:
        r = httpx.get(f"{S.supabase_url.rstrip('/')}/auth/v1/health", headers={"apikey": need["VITE_SUPABASE_PUBLISHABLE_KEY"]}, timeout=6)
        if r.status_code != 200:
            report("AVISO", "Auth do Supabase", f"HTTP {r.status_code}: login pode falhar; use 'Ver demonstracao'")
            return False
        report("OK", "Auth do Supabase", "no ar")
    except Exception as e:  # noqa: BLE001
        report("AVISO", "Internet / Supabase", f"sem resposta ({type(e).__name__}): login e dados reais indisponiveis; use o modo demonstracao (offline)")
        return False

    try:
        eng = create_engine(S.database_url, connect_args={"connect_timeout": 8, "prepare_threshold": None})
        with eng.connect() as c:
            q = lambda sql: c.execute(text(sql)).scalar()  # noqa: E731
            obs = q("select count(*) from public.observations")
            wear = q("select count(*) from public.wearable_samples")
            alerts = q("select count(*) from public.alerts")
            demo_users = q("select count(*) from auth.users where email like '%@demo.rivio.test'")
            active = q("select count(*) from public.consents where revoked_at is null and expires_at > now()")
        report("OK" if obs and wear == 489 and alerts == 5 else "AVISO", "Dados da Marta no banco", f"{obs} leituras, {wear} amostras de relogio, {alerts} alertas (esperado: 489 amostras e 5 alertas)")
        report("OK" if demo_users == 2 else "AVISO", "Contas de demonstracao", f"{demo_users} de 2 (rode scripts/seed_auth_users.py se faltar)")
        report("OK", "Consentimentos ativos agora", f"{active} (para abrir a demo do zero, revogue-os na tela de Privacidade)")
    except Exception as e:  # noqa: BLE001
        report("AVISO", "Banco (Postgres)", f"{type(e).__name__}: {str(e)[:120]}: login funciona, mas confira DATABASE_URL")
        return True
    return True


def main() -> int:
    print("PRE-VOO da demonstracao" + (" (modo offline)" if OFFLINE else ""))
    local_checks()
    if not OFFLINE:
        cloud_checks()
    fails = [r for r in rows if r[0] == "FALHA"]
    warns = [r for r in rows if r[0] == "AVISO"]
    print()
    if fails:
        print(f"{len(fails)} FALHA(S): corrija antes de subir. Sem rede? Use o modo offline (--offline).")
        return 1
    print("Pronto." if not warns else f"Pronto, com {len(warns)} aviso(s): a demo roda; os avisos dizem o que cai no plano B.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
