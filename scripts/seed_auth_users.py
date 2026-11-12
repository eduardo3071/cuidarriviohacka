"""Cria (idempotente) os usuarios de login de DEMONSTRACAO no Supabase Auth e liga a paciente e ao medico sinteticos.

    apps/api/.venv/Scripts/python.exe scripts/seed_auth_users.py

* Contas SEM SENHA e com e-mail ja confirmado, em dominio reservado (.test: nao recebe e-mail).
  A senha de uma conta e decisao de quem vai usa-la: defina pelo painel do Supabase quando precisar de login manual.
  Para testes automaticos, scripts/live_auth_check.py obtem tokens reais pelo fluxo administrativo de link magico.
* Liga patients.user_id / doctors.user_id; nunca sobrescreve uma ligacao existente diferente.
* Nao imprime segredos.
"""
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

import httpx  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.repositories.sql import make_engine  # noqa: E402
from app.storage.supabase import auth_headers  # noqa: E402

S = get_settings()
PATIENT_ID = uuid.UUID("a1000000-0000-4000-8000-000000000001")  # Marta (seed)
DOCTOR_ID = uuid.UUID("d1000000-0000-4000-8000-000000000001")  # Dr. Henrique Tavares (seed)

USERS = [
    ("paciente", "marta@demo.rivio.test", "patients", PATIENT_ID),
    ("medico", "dr.henrique@demo.rivio.test", "doctors", DOCTOR_ID),
]


def get_or_create(client: httpx.Client, base: str, headers: dict, email: str) -> tuple[uuid.UUID, bool]:
    r = client.post(
        f"{base}/auth/v1/admin/users",
        headers=headers,
        json={"email": email, "email_confirm": True, "user_metadata": {"demo": True, "synthetic": True}},
    )
    if r.status_code == 200:
        return uuid.UUID(r.json()["id"]), True
    if r.status_code == 422 and r.json().get("error_code") == "email_exists":
        page = client.get(f"{base}/auth/v1/admin/users", headers=headers, params={"page": 1, "per_page": 200})
        page.raise_for_status()
        for u in page.json().get("users", []):
            if u.get("email") == email:
                return uuid.UUID(u["id"]), False
        raise RuntimeError(f"{email} ja existe, mas nao apareceu na listagem")
    raise RuntimeError(f"Auth recusou criar {email}: HTTP {r.status_code} {r.json().get('error_code') or r.json().get('msg')}")


def main() -> None:
    if not (S.supabase_url and S.supabase_secret_key and S.database_url):
        sys.exit("Faltam SUPABASE_URL / SUPABASE_SECRET_KEY / DATABASE_URL no .env")
    base = S.supabase_url.rstrip("/")
    headers = auth_headers(S.supabase_secret_key)
    engine = make_engine(S.database_url)
    with httpx.Client(timeout=30) as client:
        for label, email, table, row_id in USERS:
            uid, created = get_or_create(client, base, headers, email)
            with engine.begin() as c:
                row = c.execute(
                    text(f"update public.{table} set user_id = :u where id = :id and (user_id is null or user_id = :u) returning id"),
                    {"u": uid, "id": row_id},
                ).first()
                if row is None:
                    raise SystemExit(f"{table}.{row_id} ja esta ligado a OUTRO usuario: nao sobrescrevi")
            print(f"  {label:<9} {email:<30} user_id={uid}  ({'criado' if created else 'ja existia'}) -> {table} ligado")


if __name__ == "__main__":
    print("== usuarios de demonstracao (Supabase Auth) ==")
    main()
