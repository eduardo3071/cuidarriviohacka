"""Desfaz o envio ao vivo do laudo de demonstracao, para ensaiar de novo (ou para abrir a demo do zero).

    apps/api/.venv/Scripts/python.exe scripts/reset_demo_upload.py

Remove SO o documento cujo conteudo e exatamente data/synthetic/marta/exams/demo_upload_2026-11.pdf (pelo sha256),
com as leituras, o job e os arquivos dele. Nada mais e tocado. Mostra o que removeu e confere o resultado.
"""
import hashlib
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "apps" / "api"))

import httpx  # noqa: E402
from live_check import S  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.repositories.sql import make_engine  # noqa: E402
from app.storage.supabase import auth_headers  # noqa: E402

PDF = ROOT / "data" / "synthetic" / "marta" / "exams" / "demo_upload_2026-11.pdf"


def main() -> int:
    if not PDF.exists():
        print("Laudo de demonstracao nao existe (rode scripts/make_demo_upload.py). Nada a fazer.")
        return 0
    sha = hashlib.sha256(PDF.read_bytes()).hexdigest()
    engine = make_engine(S.database_url)
    with engine.begin() as c:
        docs = c.execute(text("select id, storage_path, page_paths from public.documents where sha256 = :s"), {"s": sha}).all()
        if not docs:
            print("O laudo de demonstracao nao esta no historico. Nada a fazer.")
            return 0
        ids = [d.id for d in docs]
        n_obs = c.execute(text("delete from public.observations where document_id = any(:ids)"), {"ids": ids}).rowcount
        c.execute(text("delete from public.jobs where document_id = any(:ids)"), {"ids": ids})
        c.execute(text("delete from public.documents where id = any(:ids)"), {"ids": ids})
    headers = auth_headers(S.supabase_secret_key)
    paths = [p for d in docs for p in [d.storage_path, *(d.page_paths or [])]]
    for p in paths:
        httpx.delete(f"{S.supabase_url.rstrip('/')}/storage/v1/object/{S.storage_bucket}/{p}", headers=headers, timeout=30)
    with engine.connect() as c:
        left = c.execute(text("select count(*) from public.documents where sha256 = :s"), {"s": sha}).scalar()
    print(f"Removido: {len(docs)} documento(s), {n_obs} leitura(s), {len(paths)} arquivo(s). Restam {left} com esse conteudo.")
    return 0 if left == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
