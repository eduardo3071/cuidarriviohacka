"""Gera exames SINTETICOS de teste (3 layouts de laboratorio + 1 foto simulada) e o gabarito.

    apps/api/.venv/Scripts/python.exe scripts/make_test_exams.py

Fonte dos valores: data/synthetic/marta/observations.csv (mesmos dados do seed).
Saida: data/synthetic/marta/exams/
    aurora_2023.pdf      tabela com bordas, decimal com virgula
    lakeside_2019.pdf    ingles, linhas simples com flag H/L, decimal com ponto
    vita_2026.pdf        entrada em DUAS linhas (nome / "Resultado: ... Valor de referencia: ...")
    aurora_2023_foto.jpg foto SIMULADA (rotacao, desfoque, sombra, JPEG). Troque por fotos reais!
    *.truth.json         gabarito de cada exame

Os layouts sao ficticios. Nao representam nenhum laboratorio real.
"""
import csv
import json
import random
from pathlib import Path

import pymupdf
from fpdf import FPDF
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "synthetic" / "marta"
OUT = BASE / "exams"

PATIENT = "Marta Albuquerque Lima"
BIRTH = "14/03/1968"


def load_rows() -> list[dict]:
    with open(BASE / "observations.csv", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def pick(rows, date, lab):
    return [r for r in rows if r["collected_at"] == date and r["lab_name"] == lab]


def latin1(s: str) -> str:
    """fpdf2 com fontes core so aceita latin-1."""
    return s.encode("latin-1", "replace").decode("latin-1")


def num_str(v: str, comma: bool) -> str:
    return v.replace(".", ",") if comma else v


def br_date(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{d}/{m}/{y}"


def flag(r) -> str:
    v = float(r["value"])
    if r["ref_high"] and v > float(r["ref_high"]):
        return "H"
    if r["ref_low"] and v < float(r["ref_low"]):
        return "L"
    return ""


def new_pdf() -> FPDF:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    return pdf


# ---------------------------------------------------------------- layouts
def make_aurora(rows, date, path):
    pdf = new_pdf()
    pdf.set_font("Helvetica", "B", 15)
    pdf.cell(0, 9, "LABORATORIO AURORA", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, "Laudo de exames laboratoriais - Responsavel tecnico: Dra. Ana Prado CRBM 00000", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, latin1(f"Paciente: {PATIENT}     Nascimento: {BIRTH}     Sexo: F"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Data da coleta: {br_date(date)}     Material: Soro     Jejum: 12 horas", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(225, 232, 240)
    for w, t in [(75, "Exame"), (28, "Resultado"), (27, "Unidade"), (60, "Valores de referencia")]:
        pdf.cell(w, 7, t, border=1, fill=True)
    pdf.ln(7)
    pdf.set_font("Helvetica", "", 10)
    for r in rows:
        pdf.cell(75, 7, latin1(r["raw_name"]), border=1)
        pdf.cell(28, 7, num_str(r["value"], True), border=1, align="R")
        pdf.cell(27, 7, latin1(r["unit"]), border=1)
        pdf.cell(60, 7, latin1(r["ref_text"]), border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(0, 4, "Resultados validados eletronicamente. Em caso de duvida procure seu medico. Liberado em 2 dias uteis. Protocolo 2023-448812.")
    pdf.output(str(path))


def make_lakeside(rows, date, path):
    pdf = new_pdf()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 9, "Lakeside Medical Centre - Clinical Laboratory", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, f"Patient: {PATIENT}   DOB: 1968-03-14   Collected: {date}   Fasting: Yes", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 10)
    for w, t in [(62, "Test"), (22, "Result"), (24, "Units"), (14, "Flag"), (50, "Reference range")]:
        pdf.cell(w, 7, t)
    pdf.ln(7)
    pdf.set_font("Helvetica", "", 10)
    for r in rows:
        pdf.cell(62, 6.5, latin1(r["raw_name"]))
        pdf.cell(22, 6.5, r["value"], align="R")
        pdf.cell(24, 6.5, "  " + latin1(r["unit"]))
        pdf.cell(14, 6.5, flag(r))
        pdf.cell(50, 6.5, f"({latin1(r['ref_text'])})", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(0, 4, "H = above reference range, L = below reference range. Reviewed by Dr. J. Whitfield, MD. Report 19-082134-7.")
    pdf.output(str(path))


def make_vita(rows, date, path):
    pdf = new_pdf()
    pdf.set_font("Helvetica", "B", 15)
    pdf.cell(0, 9, "DIAGNOSTICOS VITA", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, latin1(f"Paciente: {PATIENT}  |  Coleta: {br_date(date)}  |  Pedido: 7731902  |  Convenio: Particular"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    for r in rows:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, latin1(r["raw_name"].upper()), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        res = f"Resultado: {num_str(r['value'], True)} {latin1(r['unit'])}"
        ref = latin1(r["ref_text"]).replace(" - ", " a ")
        pdf.cell(80, 6, res)
        pdf.cell(0, 6, f"Valor de referencia: {ref}", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "I", 8)
        pdf.cell(0, 4.5, "Metodo: automatizado (quimica seca). Material: soro.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
    pdf.output(str(path))


# ---------------------------------------------------------------- foto simulada
def simulate_photo(pdf_path: Path, jpg_path: Path, seed: int = 7) -> None:
    random.seed(seed)
    pix = pymupdf.open(str(pdf_path))[0].get_pixmap(dpi=130)
    png = jpg_path.with_suffix(".tmp.png")
    pix.save(str(png))
    page = Image.open(png).convert("RGB")
    png.unlink()
    page = page.filter(ImageFilter.GaussianBlur(0.9))
    page = ImageEnhance.Contrast(page).enhance(0.82)
    page = ImageEnhance.Brightness(page).enhance(0.93)
    # sombra diagonal (gradiente) para imitar iluminacao ruim
    w, h = page.size
    shade = Image.linear_gradient("L").resize((w, h)).rotate(35, expand=False, fillcolor=255)
    shade = shade.point(lambda p: 175 + p * 80 // 255)
    page = Image.composite(page, Image.new("RGB", (w, h), (70, 70, 70)), shade)
    # papel levemente torto sobre a mesa
    canvas = Image.new("RGB", (w + 160, h + 160), (96, 78, 62))
    rotated = page.rotate(2.6, expand=True, fillcolor=(96, 78, 62))
    canvas.paste(rotated, (40, 30))
    canvas.save(jpg_path, "JPEG", quality=68)


def write_truth(rows, meta, path):
    truth = [
        {
            "raw_name": r["raw_name"],
            "value": float(r["value"]),
            "unit": r["unit"],
            "ref_low": float(r["ref_low"]) if r["ref_low"] else None,
            "ref_high": float(r["ref_high"]) if r["ref_high"] else None,
            "ref_text": r["ref_text"],
        }
        for r in rows
    ]
    path.write_text(json.dumps({"meta": meta, "observations": truth}, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = load_rows()
    jobs = [
        ("aurora_2023", "2023-10-17", "Laboratorio Aurora", make_aurora),
        ("lakeside_2019", "2019-08-21", "Lakeside Medical Centre", make_lakeside),
        ("vita_2026", "2026-09-28", "Diagnosticos Vita", make_vita),
    ]
    for name, date, lab, maker in jobs:
        sel = pick(rows, date, lab)
        maker(sel, date, OUT / f"{name}.pdf")
        write_truth(sel, {"file": f"{name}.pdf", "lab": lab, "collected_at": date, "kind": "pdf_text"}, OUT / f"{name}.truth.json")
        print(f"{name}.pdf  ({len(sel)} resultados)")

    simulate_photo(OUT / "aurora_2023.pdf", OUT / "aurora_2023_foto.jpg")
    sel = pick(rows, "2023-10-17", "Laboratorio Aurora")
    write_truth(
        sel,
        {"file": "aurora_2023_foto.jpg", "lab": "Laboratorio Aurora", "collected_at": "2023-10-17", "kind": "photo_simulated"},
        OUT / "aurora_2023_foto.truth.json",
    )
    print("aurora_2023_foto.jpg (foto simulada)")


if __name__ == "__main__":
    main()
