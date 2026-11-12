"""Verificacao AO VIVO com usuarios REAIS do Supabase Auth (depois de scripts/seed_auth_users.py).

    apps/api/.venv/Scripts/python.exe scripts/live_auth_check.py

Tokens reais SEM senha: fluxo administrativo de link magico (generate_link + verify). Nunca imprime tokens.
Cobre: validacao do JWT ES256 pelo JWKS; API HTTP com servicos reais (upload -> job -> revisao -> confirmacao);
RLS com usuarios reais via PostgREST (consentimento: conceder, ver, tentar burlar, revogar).
Remove tudo que cria (documentos, objetos, consentimentos) e confere o estado final. As CONTAS ficam.
"""
import hashlib
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "apps" / "api"))

import httpx  # noqa: E402
import jwt  # noqa: E402
import live_check as lc  # noqa: E402  (reaproveita check()/scrub(); S = configuracoes)
from fastapi.testclient import TestClient  # noqa: E402
from live_check import check  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.auth import AuthError  # noqa: E402
from app.core.services import build_services  # noqa: E402
from app.main import create_app  # noqa: E402
from app.repositories.sql import make_engine  # noqa: E402
from app.storage.supabase import auth_headers  # noqa: E402

S = lc.S
PATIENT = uuid.UUID("a1000000-0000-4000-8000-000000000001")
DOCTOR = uuid.UUID("d1000000-0000-4000-8000-000000000001")
EMAILS = {"patient": "marta@demo.rivio.test", "doctor": "dr.henrique@demo.rivio.test"}
EXAM = ROOT / "data" / "synthetic" / "marta" / "exams" / "aurora_2023.pdf"


def main() -> int:
    base = S.supabase_url.rstrip("/")
    H = auth_headers(S.supabase_secret_key)
    engine = make_engine(S.database_url)
    svc = build_services(S)
    t0 = datetime.now(UTC)

    def counts() -> dict:
        with engine.connect() as c:
            q = lambda t: c.execute(text(f"select count(*) from {t}")).scalar()  # noqa: E731
            return {
                "documents": q("public.documents"), "jobs": q("public.jobs"), "observations": q("public.observations"),
                "consents": q("public.consents"), "auth_users": q("auth.users"),
                "wearable_samples": q("public.wearable_samples"), "alerts": q("public.alerts"),
            }  # fmt: skip

    before = counts()
    tokens: dict[str, str] = {}
    created_consents: list[str] = []

    def token_for(email: str) -> str:
        r = httpx.post(f"{base}/auth/v1/admin/generate_link", headers=H, json={"type": "magiclink", "email": email}, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"generate_link HTTP {r.status_code} {r.json().get('error_code') or r.json().get('msg')}")
        v = httpx.post(
            f"{base}/auth/v1/verify", headers=H, json={"type": "magiclink", "token_hash": r.json()["hashed_token"]}, timeout=30
        )
        if v.status_code != 200:
            raise RuntimeError(f"verify HTTP {v.status_code} {v.json().get('error_code') or v.json().get('msg')}")
        tok = v.json()["access_token"]
        lc.SECRETS.extend([tok, v.json().get("refresh_token") or ""])
        return tok

    def rest(path: str, tok: str, method: str = "GET", **kw) -> httpx.Response:
        """PostgREST como o USUARIO: apikey (a chave secreta identifica o app) + o JWT dele em Authorization."""
        return httpx.request(method, f"{base}/rest/v1/{path}", headers={**H, "Authorization": f"Bearer {tok}", **kw.pop("headers", {})}, timeout=30, **kw)

    def total(path: str, tok: str) -> int:
        r = rest(path, tok, headers={"Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"})
        assert r.status_code in (200, 206), f"HTTP {r.status_code}"
        return int(r.headers["content-range"].split("/")[1])

    def kinds(tok: str) -> set:
        r = rest("timeline_events?select=kind", tok)
        assert r.status_code == 200, r.status_code
        return {row["kind"] for row in r.json()}

    @check("login real sem senha: link magico -> sessao, token ES256")
    def _():
        for who, email in EMAILS.items():
            tokens[who] = token_for(email)
        algs = {jwt.get_unverified_header(t)["alg"] for t in tokens.values()}
        assert algs == {"ES256"}, algs
        return f"2 sessoes; alg={algs.pop()}"

    if not _():
        return finish(before, counts, engine, t0, svc, base, H)

    @check("JwtVerifier real: valida os 2 tokens, ids batem, token adulterado e rejeitado")
    def _():
        with engine.connect() as c:
            want = {
                "patient": c.execute(text("select user_id from public.patients where id=:i"), {"i": PATIENT}).scalar(),
                "doctor": c.execute(text("select user_id from public.doctors where id=:i"), {"i": DOCTOR}).scalar(),
            }
        for who in ("patient", "doctor"):
            assert svc.verifier.verify(tokens[who]).id == want[who], f"{who}: id do token diferente do ligado"
        bad = tokens["patient"][:-4] + ("AAAA" if not tokens["patient"].endswith("AAAA") else "BBBB")
        try:
            svc.verifier.verify(bad)
            raise AssertionError("token adulterado foi aceito")
        except AuthError:
            pass
        return "ids = users ligados em patients/doctors; adulterado -> AuthError"

    _()

    @check("repo: o token do paciente resolve a Marta; o do medico nao e paciente")
    def _():
        p = svc.repo.get_patient_id_for_user(svc.verifier.verify(tokens["patient"]).id)
        d = svc.repo.get_patient_id_for_user(svc.verifier.verify(tokens["doctor"]).id)
        assert p == PATIENT and d is None, (p, d)

    _()

    client = TestClient(create_app(svc))
    bearer = lambda who: {"Authorization": f"Bearer {tokens[who]}"}  # noqa: E731

    @check("HTTP real: sem token 401, token falso 401, medico 403 (nao e paciente)")
    def _():
        pdf = ("x.pdf", EXAM.read_bytes(), "application/pdf")
        assert client.post("/documents", files={"file": pdf}).status_code == 401
        assert client.post("/documents", files={"file": pdf}, headers={"Authorization": "Bearer abc.def.ghi"}).status_code == 401
        r = client.post("/documents", files={"file": pdf}, headers=bearer("doctor"))
        assert r.status_code == 403 and r.json()["detail"]["code"] == "no_patient_profile", (r.status_code, r.text[:80])

    _()

    @check("HTTP real: paciente envia o PDF -> job -> revisao (11 leituras com caixa) -> confirma (idempotente)")
    def _():
        data = EXAM.read_bytes()
        up = client.post("/documents", files={"file": ("laudo.pdf", data, "application/pdf")}, headers=bearer("patient"))
        assert up.status_code == 202, (up.status_code, up.text[:120])
        doc, job = up.json()["document_id"], up.json()["job_id"]
        again = client.post("/documents", files={"file": ("laudo.pdf", data, "application/pdf")}, headers=bearer("patient"))
        assert again.status_code == 200 and again.json()["duplicate"] is True, "reenvio nao foi idempotente"
        j = client.get(f"/jobs/{job}", headers=bearer("patient")).json()
        assert j["status"] == "succeeded", j
        review = client.get(f"/documents/{doc}/review", headers=bearer("patient")).json()
        assert review["method"] == "text_layer" and len(review["observations"]) == 11 and review["collected_at"] == "2023-10-17"
        assert all(o["bbox"] for o in review["observations"])
        page = httpx.get(review["pages"][0]["url"], timeout=30)
        assert page.status_code == 200 and page.content[:3] == b"\xff\xd8\xff", "pagina assinada nao e JPEG"
        assert client.get(f"/documents/{doc}", headers=bearer("doctor")).status_code == 403
        body = {"collected_at": review["collected_at"], "lab_name": "Laboratorio Aurora", "observations": review["observations"]}
        c1 = client.post(f"/documents/{doc}/confirm", json=body, headers=bearer("patient"))
        c2 = client.post(f"/documents/{doc}/confirm", json=body, headers=bearer("patient"))
        assert c1.json() == {"confirmed": 11, "submitted": 11, "already": False}, c1.text
        assert c2.json()["already"] is True
        return "202 -> job ok -> reenvio 200 duplicado -> revisao -> pagina JPEG assinada -> confirmar 11 / repetir already"

    _()

    @check("RLS real: paciente ve as 75 series e 28 eventos; medico sem consentimento ve 0")
    def _():
        mine = total("observation_series?select=observation_id&raw_name=not.like.*LIVE*", tokens["patient"])
        ev = total("timeline_events?select=kind", tokens["patient"])
        doc_view = total("observation_series?select=observation_id", tokens["doctor"])
        assert doc_view == 0, f"medico SEM consentimento viu {doc_view} linhas (a chave secreta vazou poder para o JWT do usuario?)"
        return f"paciente: {mine} leituras (inclui as 11 do teste) / {ev} eventos; medico: {doc_view}"

    _()

    @check("consentimento real: paciente concede 'exams' -> medico ve as series e SO eventos de exame")
    def _():
        exp = (datetime.now(UTC) + timedelta(days=1)).isoformat()
        r = rest("consents", tokens["patient"], "POST", headers={"Prefer": "return=representation"},
                 json={"patient_id": str(PATIENT), "doctor_id": str(DOCTOR), "categories": ["exams"], "expires_at": exp})  # fmt: skip
        assert r.status_code == 201, f"HTTP {r.status_code} {r.text[:120]}"
        created_consents.append(r.json()[0]["id"])
        n = total("observation_series?select=observation_id", tokens["doctor"])
        k = kinds(tokens["doctor"])
        assert n >= 75 and k == {"exam"}, (n, k)
        return f"medico ve {n} leituras; tipos de evento {sorted(k)} (consulta/remedio/vacina continuam ocultos)"

    _()

    @check("anti-burla: o medico NAO consegue conceder consentimento a si mesmo")
    def _():
        exp = (datetime.now(UTC) + timedelta(days=1)).isoformat()
        r = rest("consents", tokens["doctor"], "POST", headers={"Prefer": "return=representation"},
                 json={"patient_id": str(PATIENT), "doctor_id": str(DOCTOR), "categories": ["exams", "history", "wearables"], "expires_at": exp})  # fmt: skip
        assert r.status_code in (401, 403), f"o medico conseguiu criar consentimento: HTTP {r.status_code}"
        if r.status_code == 201:
            created_consents.append(r.json()[0]["id"])
        return f"recusado (HTTP {r.status_code})"

    _()

    @check("revogacao real: paciente revoga -> o medico perde o acesso na hora")
    def _():
        r = rest(f"consents?id=eq.{created_consents[0]}", tokens["patient"], "PATCH", headers={"Prefer": "return=representation"},
                 json={"revoked_at": datetime.now(UTC).isoformat()})  # fmt: skip
        assert r.status_code == 200 and len(r.json()) == 1, f"HTTP {r.status_code} {r.text[:100]}"
        assert total("observation_series?select=observation_id", tokens["doctor"]) == 0
        assert kinds(tokens["doctor"]) == set()
        return "medico: 0 leituras e 0 eventos depois da revogacao"

    _()

    # ================================================================ relogio e alertas (Fase 5)
    @check("relogio real: paciente ve as 489 amostras, os 5 alertas e os 5 eventos de alerta; medico sem consentimento ve 0")
    def _():
        mine = (total("wearable_samples?select=id", tokens["patient"]), total("alerts?select=id", tokens["patient"]),
                total("timeline_events?select=kind&kind=eq.alert", tokens["patient"]))  # fmt: skip
        assert mine == (489, 5, 5), mine
        theirs = (total("wearable_samples?select=id", tokens["doctor"]), total("alerts?select=id", tokens["doctor"]))
        assert theirs == (0, 0), f"medico SEM consentimento viu {theirs}"
        return f"paciente (amostras, alertas, eventos) = {mine}; medico = {theirs}"

    _()

    @check("consentimento 'wearables': medico ve amostras e alertas, e SO eventos de alerta; nao ve exames nem consultas")
    def _():
        exp = (datetime.now(UTC) + timedelta(days=1)).isoformat()
        r = rest("consents", tokens["patient"], "POST", headers={"Prefer": "return=representation"},
                 json={"patient_id": str(PATIENT), "doctor_id": str(DOCTOR), "categories": ["wearables"], "expires_at": exp})  # fmt: skip
        assert r.status_code == 201, f"HTTP {r.status_code} {r.text[:100]}"
        created_consents.append(r.json()[0]["id"])
        seen = (total("wearable_samples?select=id", tokens["doctor"]), total("alerts?select=id", tokens["doctor"]))
        assert seen == (489, 5), seen
        assert kinds(tokens["doctor"]) == {"alert"}, kinds(tokens["doctor"])
        assert total("observation_series?select=observation_id", tokens["doctor"]) == 0, "viu exames sem consentimento de exams"
        return f"medico: {seen[0]} amostras, {seen[1]} alertas; tipos de evento ['alert']; exames: 0"

    _()

    @check("a evidencia chega ao medico inteira (regra, observado, serie com os 4 avisos)")
    def _():
        r = rest("alerts?select=kind,severity,message,evidence&kind=eq.irregular_rhythm", tokens["doctor"])
        assert r.status_code == 200 and len(r.json()) == 1, r.text[:100]
        a = r.json()[0]
        ev = a["evidence"]
        assert a["severity"] == "attention" and "não é um diagnóstico" in a["message"]
        assert ev["rule"] and ev["observed"].startswith("4 avisos") and len(ev["series"][0]["points"]) == 4
        return f"regra e {len(ev['series'][0]['points'])} pontos de evidencia preservados no jsonb"

    _()

    @check("anti-burla: medico NAO altera alerta nem insere amostra")
    def _():
        r = rest("alerts?kind=eq.irregular_rhythm", tokens["doctor"], "PATCH", headers={"Prefer": "return=representation"},
                 json={"acknowledged_at": datetime.now(UTC).isoformat()})  # fmt: skip
        assert r.status_code in (401, 403) or (r.status_code == 200 and r.json() == []), f"medico alterou: HTTP {r.status_code} {r.text[:80]}"
        with engine.connect() as c:
            assert c.execute(text("select count(*) from public.alerts where acknowledged_at is not null")).scalar() == 0
        ins = rest("wearable_samples", tokens["doctor"], "POST", headers={"Prefer": "return=minimal"},
                   json={"patient_id": str(PATIENT), "metric": "resting_hr", "value": 1, "unit": "bpm",
                         "recorded_at": "2026-12-01T07:00:00-03:00", "source": "livecheck"})  # fmt: skip
        assert ins.status_code in (401, 403), f"medico inseriu amostra: HTTP {ins.status_code}"
        return f"alerta intacto; insercao recusada (HTTP {ins.status_code})"

    _()

    @check("paciente marca um alerta como visto (e a limpeza desfaz)")
    def _():
        r = rest("alerts?kind=eq.sleep_reduction", tokens["patient"], "PATCH", headers={"Prefer": "return=representation"},
                 json={"acknowledged_at": datetime.now(UTC).isoformat()})  # fmt: skip
        assert r.status_code == 200 and len(r.json()) == 1 and r.json()[0]["acknowledged_at"], r.text[:100]

    _()

    @check("revogar 'wearables' corta o acesso do medico ao relogio na hora")
    def _():
        r = rest(f"consents?id=eq.{created_consents[-1]}", tokens["patient"], "PATCH", headers={"Prefer": "return=representation"},
                 json={"revoked_at": datetime.now(UTC).isoformat()})  # fmt: skip
        assert r.status_code == 200 and len(r.json()) == 1
        after = (total("wearable_samples?select=id", tokens["doctor"]), total("alerts?select=id", tokens["doctor"]))
        assert after == (0, 0) and kinds(tokens["doctor"]) == set(), after

    _()

    return finish(before, counts, engine, t0, svc, base, H, created_consents)


def finish(before, counts, engine, t0, svc, base, H, consents=()) -> int:
    print("\n  limpando o que o teste criou (as contas ficam)...")
    with engine.begin() as c:
        docs = c.execute(text("select id, storage_path, page_paths from public.documents where created_at >= :t"), {"t": t0}).all()
        ids = [d.id for d in docs]
        c.execute(text("delete from public.consents where id = any(cast(:ids as uuid[])) or granted_at >= :t"), {"ids": list(consents), "t": t0})
        c.execute(text("delete from public.observations where document_id = any(:ids)"), {"ids": ids})
        c.execute(text("delete from public.jobs where document_id = any(:ids)"), {"ids": ids})
        c.execute(text("delete from public.documents where id = any(:ids)"), {"ids": ids})
        c.execute(text("update public.alerts set acknowledged_at = null where patient_id = :p"), {"p": PATIENT})
    paths = [p for d in docs for p in [d.storage_path, *d.page_paths]]
    for p in paths:
        httpx.delete(f"{base}/storage/v1/object/{S.storage_bucket}/{p}", headers=H, timeout=30)

    @check("limpeza: banco e storage voltaram ao que eram (contas mantidas)")
    def _():
        after = counts()
        assert after == before, f"antes={before} depois={after}"
        for p in paths:
            try:
                svc.storage.get(p)
                raise AssertionError(f"objeto sobrou: {p}")
            except Exception as e:  # noqa: BLE001
                assert "sobrou" not in str(e), e
        return f"contagens identicas {after}; {len(paths)} objeto(s) apagado(s)"

    _()
    failed = [n for n, ok, _ in lc.results if not ok]
    print(f"\n{'TUDO OK' if not failed else 'FALHARAM: ' + ', '.join(failed)}  ({len(lc.results) - len(failed)}/{len(lc.results)})")
    return 1 if failed else 0


if __name__ == "__main__":
    print("== login e RLS com usuarios reais (Supabase real) ==")
    sys.exit(main())
