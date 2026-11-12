"""Define a senha de UMA conta de demonstracao, digitada por voce no seu proprio terminal.

    apps/api/.venv/Scripts/python.exe scripts/set_demo_password.py marta@demo.rivio.test
    apps/api/.venv/Scripts/python.exe scripts/set_demo_password.py dr.henrique@demo.rivio.test

A senha e lida com getpass (nao aparece na tela, nao vai para historico nem para argumentos) e enviada so ao
Supabase Auth (API administrativa). Nada e impresso. Use uma senha sua, de 12+ caracteres, que NAO seja usada em
outro lugar: ela entra no ensaio e na demonstracao. So aceita as contas @demo.rivio.test.
"""
import getpass
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "apps" / "api"))

import httpx  # noqa: E402
from live_check import S  # noqa: E402  (configuracoes lidas do .env)

from app.storage.supabase import auth_headers  # noqa: E402

DOMAIN = "@demo.rivio.test"


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].endswith(DOMAIN):
        print(f"uso: set_demo_password.py <email>   (somente contas {DOMAIN})")
        return 2
    email = sys.argv[1].lower()
    base = S.supabase_url.rstrip("/")
    headers = auth_headers(S.supabase_secret_key)

    pw = getpass.getpass(f"Nova senha para {email}: ")
    if len(pw) < 12:
        print("A senha precisa ter pelo menos 12 caracteres.")
        return 1
    if getpass.getpass("Repita a senha: ") != pw:
        print("As senhas nao conferem.")
        return 1

    # acha o usuario pelo e-mail (a lista administrativa e pequena; as contas de demonstracao sao 2)
    r = httpx.get(f"{base}/auth/v1/admin/users", headers=headers, params={"per_page": 200}, timeout=30)
    if r.status_code != 200:
        print(f"Nao foi possivel listar usuarios (HTTP {r.status_code}).")
        return 1
    users = [u for u in r.json().get("users", []) if (u.get("email") or "").lower() == email]
    if not users:
        print("Conta nao encontrada. Rode scripts/seed_auth_users.py antes.")
        return 1

    u = httpx.put(f"{base}/auth/v1/admin/users/{users[0]['id']}", headers=headers, json={"password": pw}, timeout=30)
    if u.status_code != 200:
        # sem ecoar o corpo: pode citar a regra de senha, mas nunca a senha
        print(f"Falhou (HTTP {u.status_code}): {u.json().get('msg') or u.json().get('error_code') or 'erro'}")
        return 1
    print(f"Senha definida para {email}. Entre pelo front com ela.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
