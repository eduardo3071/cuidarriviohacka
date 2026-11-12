"""Verificacao AO VIVO dos adaptadores contra o Supabase real. Precisa do .env preenchido.

    apps/api/.venv/Scripts/python.exe scripts/live_check.py           # so confere o formato do .env (sem rede)
    apps/api/.venv/Scripts/python.exe scripts/live_check.py --live    # roda contra o projeto

Nunca imprime segredos (chave, senha): tudo que sai passa por scrub().
Os testes ao vivo criam linhas/objetos com prefixo LIVECHECK e os REMOVEM no final (mesmo se falhar);
no fim confere que o banco e o storage voltaram ao que eram.
"""
import base64
import json
import sys
import traceback
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

import httpx  # noqa: E402
import jwt  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from app.core.config import get_settings  # noqa: E402

S = get_settings()
PATIENT = uuid.UUID("a1000000-0000-4000-8000-000000000001")  # Marta (seed sintetico)
EXAM = ROOT / "data" / "synthetic" / "marta" / "exams" / "aurora_2023.pdf"
PROJECT_REF = "itbtpzdxatpkndgsxdlx"

_url = make_url(S.database_url) if S.database_url else None
SECRETS = [v for v in (S.supabase_secret_key, S.anthropic_api_key, _url.password if _url else None) if v]


def scrub(msg: str) -> str:
    for sec in SECRETS:
        msg = msg.replace(sec, "***")
    return msg


results: list[tuple[str, bool, str]] = []


def check(name: str):
    def deco(fn):
        def run(*a, **k):
            try:
                detail = fn(*a, **k) or ""
                results.append((name, True, str(detail)))
                print(f"  OK    {name}  {scrub(str(detail))}")
                return True
            except Exception as e:  # noqa: BLE001
                msg = scrub(f"{type(e).__name__}: {e}")[:300]
                results.append((name, False, msg))
                print(f"  FALHA {name}  {msg}")
                if "-v" in sys.argv:
                    print(scrub(traceback.format_exc()))
                return False

        return run

    return deco


# ---------------------------------------------------------------- 1) formato do .env (sem rede)
def key_kind(key: str) -> str:
    if key.startswith("sb_secret_"):
        return "secret (novo formato)"
    if key.startswith("sb_publishable_"):
        raise ValueError("e a chave PUBLICAVEL (publishable), nao a secreta: o backend precisa da secret/service_role")
    if key.startswith("eyJ"):
        try:
            payload = json.loads(base64.urlsafe_b64decode(key.split(".")[1] + "=="))
        except Exception as e:  # noqa: BLE001
            raise ValueError("parece um JWT mas nao decodifica") from e
        role = payload.get("role")
        if role != "service_role":
            raise ValueError(f"o JWT tem role={role!r}; precisa ser 'service_role' (voce colou a anon?)")
        if payload.get("ref") not in (None, PROJECT_REF):
            raise ValueError("a chave e de OUTRO projeto")
        return "JWT legado service_role"
    raise ValueError("formato desconhecido (esperado sb_secret_... ou JWT service_role)")


@check("SUPABASE_URL")
def c_url():
    if not S.supabase_url:
        raise ValueError("vazio")
    host = httpx.URL(S.supabase_url).host
    if host != f"{PROJECT_REF}.supabase.co":
        raise ValueError(f"host {host!r} nao e o do projeto Rivio-Hackathon")
    return host


@check("SUPABASE_SECRET_KEY")
def c_key():
    if not S.supabase_secret_key:
        raise ValueError("vazio")
    return f"{key_kind(S.supabase_secret_key)}, {len(S.supabase_secret_key)} caracteres"


@check("DATABASE_URL")
def c_db_url():
    if _url is None:
        raise ValueError("vazio")
    if _url.drivername != "postgresql+psycopg":
        raise ValueError(f"driver {_url.drivername!r}; use postgresql+psycopg://")
    if not _url.password or _url.password.startswith("<") or "SENHA" in _url.password.upper():
        raise ValueError("senha ausente ou ainda e o placeholder")
    host = _url.host or ""
    if "pooler.supabase.com" in host:
        kind = "pooler" + (" (transaction)" if _url.port == 6543 else f" (porta {_url.port}: o recomendado e 6543)")
        if not (_url.username or "").endswith(f".{PROJECT_REF}"):
            raise ValueError(f"no pooler o usuario deve ser postgres.{PROJECT_REF}")
    elif host == f"db.{PROJECT_REF}.supabase.co":
        kind = "conexao direta (so IPv6 no plano gratuito; se falhar, use o pooler)"
    else:
        raise ValueError(f"host {host!r} nao parece do Supabase")
    return f"{host}:{_url.port} {kind}"


# ---------------------------------------------------------------- 2) ao vivo
def live(db_only: bool = False) -> None:
    from app.core.services import build_services
    from app.repositories.base import DocumentNotFound
    from app.repositories.sql import SqlRepository, make_engine
    from app.services.documents.pipeline import process_job
    from app.storage.base import StorageError
    from app.storage.supabase import auth_headers

    engine = make_engine(S.database_url)
    repo = SqlRepository(engine)
    svc = None if db_only else build_services(S)  # --db-only: sem a chave nao ha storage nem pipeline
    storage = svc.storage if svc else None
    base = S.supabase_url.rstrip("/")
    tag = uuid.uuid4().hex[:10]
    created_docs: list[uuid.UUID] = []
    created_objects: list[str] = []

    def rest_delete(path: str) -> None:
        h = auth_headers(S.supabase_secret_key)
        httpx.delete(f"{base}/storage/v1/object/{S.storage_bucket}/{path}", headers=h, timeout=30)

    def counts() -> dict:
        with engine.connect() as c:
            return {
                t: c.execute(text(f"select count(*) from public.{t}")).scalar()
                for t in ("documents", "jobs", "observations", "consents", "patients")
            }

    before = counts()

    @check("banco: conexao e papel")
    def _():
        with engine.connect() as c:
            who, ver = c.execute(text("select current_user, split_part(version(), ' ', 2)")).one()
        return f"usuario={who} postgres={ver}"

    _()

    @check("banco: a paciente de teste (seed) existe")
    def _():
        with engine.connect() as c:
            n = c.execute(text("select count(*) from public.patients where id = :p"), {"p": PATIENT}).scalar()
        assert n == 1, "rode o seed (supabase/seed/*.sql)"
        return f"{before['observations']} observacoes no banco"

    _()

    @check("repo: usuario sem perfil de paciente -> None")
    def _():
        assert repo.get_patient_id_for_user(uuid.uuid4()) is None

    _()

    @check("repo: criar documento e job, idempotencia, reabrir apos falha")
    def _():
        sha = f"livecheck-{tag}-a"
        r1 = repo.create_document_once(PATIENT, f"{PATIENT}/livecheck-{tag}.pdf", sha, "application/pdf")
        created_docs.append(r1.document_id)
        r2 = repo.create_document_once(PATIENT, f"{PATIENT}/livecheck-{tag}.pdf", sha, "application/pdf")
        assert (r1.is_new, r2.is_new) == (True, False), (r1.is_new, r2.is_new)
        assert (r1.document_id, r1.job_id) == (r2.document_id, r2.job_id)
        assert repo.claim_job(r1.job_id) is True and repo.claim_job(r1.job_id) is False, "claim nao e atomico"
        repo.finish_job_failed(r1.job_id, r1.document_id, "livecheck", "falha simulada")
        assert repo.get_document(PATIENT, r1.document_id).status == "failed"
        r3 = repo.create_document_once(PATIENT, f"{PATIENT}/livecheck-{tag}.pdf", sha, "application/pdf")
        assert r3.is_new and r3.job_id != r1.job_id, "reenvio apos falha deveria reabrir"
        other = repo.get_document(uuid.uuid4(), r1.document_id)
        assert other is None, "outro paciente enxergou o documento"
        return "documento unico, claim atomico, retry cria novo job, isolamento ok"

    _()

    @check("repo: confirmar (idempotente) e ver na view observation_series")
    def _():
        r = repo.create_document_once(PATIENT, f"{PATIENT}/livecheck-{tag}-b.pdf", f"livecheck-{tag}-b", "application/pdf")
        created_docs.append(r.document_id)
        assert repo.claim_job(r.job_id)
        repo.finish_job_success(r.job_id, r.document_id, {"observations": []}, [], "text_layer", None, None)
        obs = [{"raw_name": f"ZZ-LIVECHECK {tag}", "canonical_name": "Glicemia de jejum", "value": 5.5, "unit": "mmol/L",
                "ref_low": 3.9, "ref_high": 5.5, "ref_text": "3.9 - 5.5", "confidence": 0.9, "page": 1,
                "bbox": [0.1, 0.2, 0.3, 0.25], "method": "ocr", "notes": ["nota de teste"]}]  # fmt: skip
        from datetime import date

        a = repo.confirm_document(PATIENT, r.document_id, date(1999, 1, 1), "LIVECHECK Lab", obs)
        b = repo.confirm_document(PATIENT, r.document_id, date(1999, 1, 1), "LIVECHECK Lab", obs)
        assert a == {"confirmed": 1, "submitted": 1, "already": False}, a
        assert b["already"] is True, b
        try:
            repo.confirm_document(uuid.uuid4(), r.document_id, date(1999, 1, 1), "x", obs)
            raise AssertionError("outro paciente conseguiu confirmar")
        except DocumentNotFound:
            pass
        with engine.connect() as c:
            row = c.execute(
                text("select value, ref_high, normalization, flag from public.observation_series where raw_name = :n"),
                {"n": f"ZZ-LIVECHECK {tag}"},
            ).one()
        assert (float(row.value), float(row.ref_high), row.normalization, row.flag) == (99.088, 99.088, "converted", "in_range"), row
        return "5,5 mmol/L -> 99,088 mg/dL (converted, in_range) pela view; repetir devolve already"

    _()

    @check("storage: gravar, ler, URL assinada, apagar")
    def _():
        path = f"{PATIENT}/livecheck-{tag}.bin.pdf"
        payload = b"%PDF-1.4 livecheck " + tag.encode()
        storage.put(path, payload, "application/pdf")
        created_objects.append(path)
        assert storage.get(path) == payload
        url = storage.signed_url(path, 60)
        r = httpx.get(url, timeout=30)
        assert r.status_code == 200 and r.content == payload, f"URL assinada: HTTP {r.status_code}"
        rest_delete(path)
        created_objects.remove(path)
        try:
            storage.get(path)
            raise AssertionError("o objeto ainda existe depois de apagar")
        except StorageError:
            pass
        return f"ida e volta de {len(payload)} bytes; URL assinada em {httpx.URL(url).host}"

    if svc:
        _()

    @check("pipeline completo ao vivo: upload -> extracao -> revisao -> confirmacao (PDF real, sem OCR/IA)")
    def _():
        data = EXAM.read_bytes()
        import hashlib

        sha = hashlib.sha256(data).hexdigest()
        path = f"{PATIENT}/{sha}.pdf"
        storage.put(path, data, "application/pdf")
        created_objects.append(path)
        r = repo.create_document_once(PATIENT, path, sha, "application/pdf")
        created_docs.append(r.document_id)
        assert r.is_new, "este PDF de teste ja existia no banco: limpe antes"
        process_job(svc, r.job_id)
        job = repo.get_job(PATIENT, r.job_id)
        assert job.status == "succeeded", f"job {job.status}: {job.error_code} {job.error}"
        doc = repo.get_document(PATIENT, r.document_id)
        assert doc.status == "pending_review" and doc.extraction_method == "text_layer", (doc.status, doc.extraction_method)
        assert str(doc.collected_at) == "2023-10-17", doc.collected_at
        for p in doc.page_paths:
            created_objects.append(p)
            assert storage.get(p)[:3] == b"\xff\xd8\xff", "pagina guardada nao e JPEG"
            assert httpx.get(storage.signed_url(p, 60), timeout=30).status_code == 200
        found = job.result["observations"]
        assert len(found) == 11 and all(o["bbox"] for o in found), len(found)
        from datetime import date

        res = repo.confirm_document(PATIENT, r.document_id, date.fromisoformat(doc.collected_at.isoformat()), "Laboratorio Aurora", found)
        assert res["confirmed"] == 11 and res["already"] is False, res
        with engine.connect() as c:
            n = c.execute(text("select count(*) from public.observation_series where document_id = :d"), {"d": r.document_id}).scalar()
        assert n == 11, n
        return f"11 leituras com caixa, pagina JPEG guardada ({len(doc.page_paths)}), confirmadas e visiveis na view"

    if svc:
        _()

    @check("autenticacao: JWKS publico do projeto carrega (ES256)")
    def _():
        keys = jwt.PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json", timeout=15).get_signing_keys()
        assert keys, "JWKS vazio"
        return f"{len(keys)} chave(s) publica(s)"

    _()

    # ---------------------------------------------------------------- limpeza (sempre) e conferencia
    print("\n  limpando o que o teste criou...")
    with engine.begin() as c:
        for stmt in (
            "delete from public.observations where document_id = any(:ids) or raw_name like 'ZZ-LIVECHECK%'",
            "delete from public.jobs where document_id = any(:ids)",
            "delete from public.documents where id = any(:ids)",
        ):
            c.execute(text(stmt), {"ids": created_docs})
    for p in list(created_objects):
        rest_delete(p)

    @check("limpeza: banco e storage voltaram ao que eram")
    def _():
        after = counts()
        assert after == before, f"antes={before} depois={after}"
        for p in created_objects:
            try:
                storage.get(p)
                raise AssertionError(f"objeto sobrou: {p}")
            except StorageError:
                pass
        return f"contagens identicas {after}; {len(created_objects)} objeto(s) apagado(s)"

    _()


if __name__ == "__main__":
    print("== formato do .env (sem rede) ==")
    c_url()
    c_key()
    c_db_url()
    db_only = "--db-only" in sys.argv
    needed = {"SUPABASE_URL", "DATABASE_URL"} if db_only else {"SUPABASE_URL", "DATABASE_URL", "SUPABASE_SECRET_KEY"}
    cfg_ok = all(ok for name, ok, _ in results if name in needed)
    if "--live" in sys.argv or db_only:
        if not cfg_ok:
            print("\nCorrija o .env antes de rodar ao vivo.")
            sys.exit(1)
        print("\n== ao vivo (Supabase real)" + (" - SO O BANCO (sem a chave secreta) ==" if db_only else " =="))
        live(db_only)
    failed = [n for n, ok, _ in results if not ok]
    print(f"\n{'TUDO OK' if not failed else 'FALHARAM: ' + ', '.join(failed)}  ({len(results) - len(failed)}/{len(results)})")
    sys.exit(1 if failed else 0)
