"""Gera o laudo SINTETICO para enviar AO VIVO na demonstracao (um exame de controle, depois do de 28/09/2026).

    apps/api/.venv/Scripts/python.exe scripts/make_demo_upload.py

Por que um arquivo novo: os 3 laudos de data/synthetic/marta/exams ja estao no historico (o seed usa os mesmos valores).
Enviar um deles duplicaria pontos no grafico. Este tem data nova (12/11/2026) e valores diferentes, entao entra como
um exame novo, no layout de tabela (o que a leitura por texto do PDF resolve sem OCR e sem IA).
Depois do ensaio, para voltar ao estado inicial: apps/api/.venv/Scripts/python.exe scripts/reset_demo_upload.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from make_test_exams import OUT, load_rows, make_aurora, pick  # noqa: E402

DATE = "2026-11-12"
# controle depois de 6 semanas: melhora discreta, nada que o laudo "interprete"
NEW_VALUES = {
    "Glicemia de jejum": "109", "HbA1c": "5.9", "Colesterol Total": "214", "LDL": "128", "HDL": "52",
    "Triglicérides": "151", "Creatinina sérica": "0.94", "TSH ultrassensível": "3.8", "Hemoglobina (Hb)": "12.4",
    "25-Hidroxivitamina D": "28", "ALT/TGP": "33",
}  # fmt: skip


def main() -> None:
    rows = pick(load_rows(), "2026-09-28", "Diagnosticos Vita")
    assert len(rows) == len(NEW_VALUES), (len(rows), len(NEW_VALUES))
    out = [{**r, "value": NEW_VALUES[r["raw_name"]]} for r in rows]
    path = OUT / "demo_upload_2026-11.pdf"
    make_aurora(out, DATE, path)
    print(f"gerado: {path.relative_to(path.parents[4])}  ({len(out)} resultados, coleta {DATE})")


if __name__ == "__main__":
    main()
