"""Sobe a demonstracao inteira NA SUA MAQUINA com um comando (so biblioteca padrao: qualquer Python 3.9+ serve).

    python scripts/dev.py              # pre-voo + API (8000) + front (5173)
    python scripts/dev.py --offline    # SEM internet: so o front, no modo demonstracao (dados do app, sem login)
    python scripts/dev.py --no-api     # so o front (login e dados vem direto do Supabase; nao precisa da API)
    python scripts/dev.py --skip-preflight

Ctrl+C derruba tudo. Logs em .dev-logs/ (api.log e web.log).
"""
import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGS = ROOT / ".dev-logs"
API_PORT, WEB_PORT = 8000, 5173
WIN = os.name == "nt"


def venv_python() -> Path:
    p = ROOT / "apps" / "api" / ".venv" / ("Scripts/python.exe" if WIN else "bin/python")
    if not p.exists():
        sys.exit(f"Nao achei o ambiente da API ({p}). Crie: cd apps/api && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt")
    return p


def up(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            return r.status < 500
    except Exception:  # noqa: BLE001
        return False


def tail(path: Path, n: int = 12) -> str:
    try:
        return "\n".join(path.read_text(encoding="utf-8", errors="replace").splitlines()[-n:])
    except OSError:
        return "(sem log)"


def kill_tree(p: subprocess.Popen) -> None:
    if p.poll() is not None:
        return
    if WIN:  # o npm cria filhos (node/vite): so taskkill /T derruba a arvore toda
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
    else:
        p.terminate()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="sem internet: so o front, modo demonstracao")
    ap.add_argument("--no-api", action="store_true", help="nao sobe a API")
    ap.add_argument("--skip-preflight", action="store_true")
    args = ap.parse_args()
    if WIN:  # fechar o terminal / Ctrl+Break tambem derrubam tudo com limpeza (e e como os testes param o processo)
        signal.signal(signal.SIGBREAK, signal.default_int_handler)
    py = venv_python()
    npm = shutil.which("npm")
    if not npm:
        sys.exit("npm nao encontrado: instale o Node 20+.")

    if not args.skip_preflight:
        code = subprocess.run([str(py), str(ROOT / "scripts" / "preflight.py"), *(["--offline"] if args.offline else [])]).returncode
        print()
        if code != 0:
            return code

    LOGS.mkdir(exist_ok=True)
    procs: list[tuple[str, subprocess.Popen, Path]] = []

    def start(name: str, cmd: list[str], cwd: Path, env: dict | None = None) -> None:
        log = LOGS / f"{name}.log"
        f = open(log, "w", encoding="utf-8")  # noqa: SIM115  (vive enquanto o processo viver)
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if WIN else 0  # Ctrl+C nosso nao mata o filho antes da hora
        procs.append((name, subprocess.Popen(cmd, cwd=cwd, env=env, stdout=f, stderr=subprocess.STDOUT, creationflags=flags), log))

    web_env = dict(os.environ)
    if args.offline:  # sem URL/chave do Supabase o front cai sozinho no modo demonstracao
        web_env["VITE_SUPABASE_URL"] = ""
        web_env["VITE_SUPABASE_PUBLISHABLE_KEY"] = ""

    try:
        if not (args.offline or args.no_api):
            start("api", [str(py), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(API_PORT)], ROOT / "apps" / "api")
        start("web", [npm, "run", "dev", "--", "--port", str(WEB_PORT), "--strictPort"], ROOT / "apps" / "web", web_env)

        checks = {"web": f"http://localhost:{WEB_PORT}"}
        if any(n == "api" for n, _, _ in procs):
            checks["api"] = f"http://127.0.0.1:{API_PORT}/health"
        print("Subindo", ", ".join(checks), "...")
        deadline = time.time() + 90
        ready: set[str] = set()
        while len(ready) < len(checks):
            for name, p, log in procs:
                if p.poll() is not None:
                    print(f"\n'{name}' parou (codigo {p.returncode}). Ultimas linhas de {log.name}:\n{tail(log)}")
                    return 1
            for name, url in checks.items():
                if name not in ready and up(url):
                    ready.add(name)
            if time.time() > deadline:
                print("Demorou mais de 90 s. Veja .dev-logs/.")
                return 1
            time.sleep(0.5)

        print("\nTudo no ar:")
        print(f"  Front   http://localhost:{WEB_PORT}" + ("   (modo demonstracao offline: clique em 'Ver demonstracao' ou ja abre direto)" if args.offline else ""))
        if "api" in checks:
            print(f"  API     http://localhost:{API_PORT}/docs   (saude: /health)")
        print("\nCtrl+C para parar.")
        while all(p.poll() is None for _, p, _ in procs):
            time.sleep(1)
        for name, p, log in procs:
            if p.poll() not in (None, 0):
                print(f"\n'{name}' caiu (codigo {p.returncode}):\n{tail(log)}")
        return 1
    except KeyboardInterrupt:
        print("\nParando...")
        return 0
    finally:
        for _, p, _ in procs:
            kill_tree(p)


if __name__ == "__main__":
    sys.exit(main())
