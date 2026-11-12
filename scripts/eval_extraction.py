"""Roda um extrator sobre os exames de teste e imprime 'X de Y valores corretos'.

    apps/api/.venv/Scripts/python.exe scripts/eval_extraction.py                  # base: texto do PDF + regex
    apps/api/.venv/Scripts/python.exe scripts/eval_extraction.py --extractor ocr  # local: OpenCV + OCR + regex
    apps/api/.venv/Scripts/python.exe scripts/eval_extraction.py --extractor llm  # IA hospedada
    ... --extractor llm --vision    # PDFs tambem como imagem (caso de PDF escaneado)

O extrator 'llm' chama a API (custa dinheiro: ~1 chamada por pagina) e exige
ANTHROPIC_API_KEY no .env da raiz. Sem chave, ele avisa e nao chama nada.
"""
import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.core.config import get_settings  # noqa: E402
from app.services.extraction import llm_extractor, ocr_extractor, text_layer  # noqa: E402
from app.services.extraction.evaluate import score  # noqa: E402
from app.services.llm.base import LLMError  # noqa: E402
from app.services.llm.factory import get_llm_client  # noqa: E402
from app.services.normalization.ontology import load_ontology  # noqa: E402

EXAMS = ROOT / "data" / "synthetic" / "marta" / "exams"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extractor", default="text_layer", choices=["text_layer", "ocr", "llm"])
    ap.add_argument("--vision", action="store_true", help="(llm) PDFs tambem como imagem")
    args = ap.parse_args()

    onto = load_ontology(ROOT / "data" / "ontology")
    llm = None
    if args.extractor == "llm":
        settings = get_settings()
        if not settings.anthropic_api_key:
            sys.exit("Sem ANTHROPIC_API_KEY no .env da raiz do repositorio. Nada foi chamado.")
        llm = get_llm_client(settings)
        print(f"modelo: {llm.model}")

    print(f"extrator: {args.extractor}{' (vision)' if args.vision else ''}\n")
    print(f"{'exame':<24}{'tipo':<18}{'corretos':>10}{'faixa ok':>10}{'tempo':>9}{'tokens in/out':>16}")
    total = correct = ref_ok = tin = tout = 0
    for truth_path in sorted(EXAMS.glob("*.truth.json")):
        doc = json.loads(truth_path.read_text(encoding="utf-8"))
        meta, truth = doc["meta"], doc["observations"]
        path = EXAMS / meta["file"]
        toks = ""
        t0 = time.perf_counter()
        try:
            if args.extractor == "text_layer":
                extracted = text_layer.extract_observations(path, onto) if path.suffix == ".pdf" else []
            elif args.extractor == "ocr":
                # local, sem IA: PDF vira imagem (como se fosse escaneado) e tudo passa por OpenCV + OCR + regex
                pages = (
                    ocr_extractor.extract_pdf_as_scan(path, onto)
                    if path.suffix == ".pdf"
                    else [ocr_extractor.extract_page(path.read_bytes(), onto)]
                )
                extracted = [o for p in pages for o in p.observations]
            else:
                if path.suffix == ".pdf" and not args.vision:
                    out = llm_extractor.extract_pdf_text(llm, path)
                elif path.suffix == ".pdf":
                    out = llm_extractor.extract_images(llm, llm_extractor.render_pdf_pages(path))
                else:
                    out = llm_extractor.extract_images(llm, [llm_extractor.image_from_file(path)])
                extracted = out.result.observations
                tin += out.input_tokens
                tout += out.output_tokens
                toks = f"{out.input_tokens}/{out.output_tokens}"
        except LLMError as e:
            sys.exit(f"\nFalha em {meta['file']}: {e}")
        dt = time.perf_counter() - t0

        sc = score(truth, extracted, onto)
        total += sc.total
        correct += sc.correct
        ref_ok += sc.ref_correct
        print(
            f"{meta['file']:<24}{meta['kind']:<18}{sc.correct:>5}/{sc.total:<4}{sc.ref_correct:>6}/{sc.total:<3}"
            f"{dt:>8.2f}s{toks:>16}"
        )
        for label, items in (("faltou", sc.missing), ("errado", sc.wrong), ("a mais", sc.extra)):
            for it in items[:4]:
                print(f"    {label}: {it}")
            if len(items) > 4:
                print(f"    {label}: ... (+{len(items) - 4})")
    print(f"\nTOTAL: {correct}/{total} valores corretos ({correct / total:.0%}); faixa do laudo correta em {ref_ok}/{total}")
    if args.extractor == "llm":
        print(f"tokens: {tin} entrada / {tout} saida")


if __name__ == "__main__":
    main()
