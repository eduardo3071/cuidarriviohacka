"""Pre-processamento de foto/escaneamento de laudo (OpenCV, sem PyTorch).

Pipeline: decodifica -> acha o papel e corrige a perspectiva (ou, sem contorno,
corrige a inclinacao pelo texto) -> reduz ao tamanho de trabalho -> remove sombra.

A imagem devolvida e a "pagina plana" que o usuario ve: as caixas (bbox) das
leituras sao relativas a ELA, nao a foto original (que pode estar torta).
"""
from dataclasses import dataclass

import cv2
import numpy as np

MAX_SIDE = 1400  # lado maior da imagem de trabalho (px): equilibrio entre leitura e tempo de OCR
_DETECT_SIDE = 800  # a busca pelo papel roda numa copia menor (rapido)


@dataclass
class PreparedPage:
    image: np.ndarray  # BGR uint8, pagina plana (a que o usuario ve; referencia das bbox)
    ocr_image: np.ndarray  # mesma geometria, sem as linhas da tabela (entrada do OCR)
    page_found: bool  # achou o contorno do papel e corrigiu a perspectiva
    skew_deg: float  # inclinacao corrigida pelo texto quando nao achou o papel (0 se nao precisou)
    flattened: bool  # aplicou remocao de sombra


def decode(data: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("nao foi possivel decodificar a imagem")
    return img


def encode_jpeg(img: np.ndarray, quality: int = 85) -> bytes:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("falha ao codificar JPEG")
    return buf.tobytes()


def _resize_max(img: np.ndarray, max_side: int) -> np.ndarray:
    h, w = img.shape[:2]
    scale = max_side / max(h, w)
    if scale >= 1.0:
        return img
    return cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)


resize_max = _resize_max  # API publica (o roteador reduz imagens grandes antes de guardar/enviar)


def _order_points(pts: np.ndarray) -> np.ndarray:
    """Ordena 4 pontos: topo-esq, topo-dir, base-dir, base-esq."""
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], dtype=np.float32)


def find_page_quad(img: np.ndarray) -> np.ndarray | None:
    """Quadrilatero do papel (ordem tl,tr,br,bl) ou None se a imagem ja e a pagina / nao achou."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (9, 9), 0)
    _, mask = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25)))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    ratio = cv2.contourArea(c) / float(img.shape[0] * img.shape[1])
    if ratio < 0.25 or ratio > 0.97:  # pequeno demais, ou a imagem inteira ja e papel
        return None
    approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
    quad = approx.reshape(-1, 2) if len(approx) == 4 else cv2.boxPoints(cv2.minAreaRect(c))
    return _order_points(quad.astype(np.float32))


def _warp(img: np.ndarray, quad: np.ndarray) -> np.ndarray:
    tl, tr, br, bl = quad
    w = int(round(max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))))
    h = int(round(max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))))
    dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype=np.float32)
    m = cv2.getPerspectiveTransform(quad, dst)
    return cv2.warpPerspective(img, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def estimate_skew(img: np.ndarray) -> float:
    """Inclinacao do texto em graus (positivo = anti-horario), pelo retangulo minimo dos pixels escuros."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    pts = cv2.findNonZero(bw)
    if pts is None or len(pts) < 200:
        return 0.0
    angle = cv2.minAreaRect(pts)[-1]
    if angle > 45:
        angle -= 90
    elif angle < -45:
        angle += 90
    return float(angle)


def _rotate(img: np.ndarray, angle: float) -> np.ndarray:
    h, w = img.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def flatten_illumination(img: np.ndarray) -> np.ndarray:
    """Remove sombra/gradiente de luz: divide o cinza pelo fundo estimado (sem o texto)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    bg = cv2.medianBlur(cv2.dilate(gray, np.ones((7, 7), np.uint8)), 21)
    diff = 255 - cv2.absdiff(gray, bg)
    norm = cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX)
    return cv2.cvtColor(norm, cv2.COLOR_GRAY2BGR)


def illumination_variation(img: np.ndarray) -> float:
    """Variacao (p95 - p5) do brilho do fundo, em niveis de cinza: ~0 numa pagina digital limpa,
    dezenas numa foto com sombra. Decide se vale remover sombra."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    bg = cv2.medianBlur(cv2.dilate(gray, np.ones((7, 7), np.uint8)), 21)
    lo, hi = np.percentile(bg, [5, 95])
    return float(hi - lo)


# acima disso o fundo tem sombra/gradiente relevante. Medido em 3 amostras sinteticas
# (foto simulada = 48; PDFs limpos = 0): revalidar com fotos reais.
ILLUMINATION_THRESHOLD = 20.0


def remove_table_lines(img: np.ndarray) -> np.ndarray:
    """Apaga linhas longas (grade de tabela) por morfologia + inpaint.

    As bordas de celula encostam nos numeros e o OCR as le como caracteres
    ('106|mg/dL' -> '3mg/dL'). Devolve uma copia; a geometria nao muda.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    bw = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 15)
    horiz = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, w // 18), 1)))
    vert = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(25, h // 60))))
    mask = cv2.dilate(cv2.bitwise_or(horiz, vert), np.ones((3, 3), np.uint8))
    if not mask.any():
        return img.copy()
    return cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)


def prepare_page(
    data: bytes | np.ndarray, *, flatten: bool | None = None, max_side: int = MAX_SIDE
) -> PreparedPage:
    """`flatten=None` decide sozinho (so remove sombra se o fundo variar mais que o limiar)."""
    img = decode(data) if isinstance(data, (bytes, bytearray)) else data
    small = _resize_max(img, _DETECT_SIDE)
    quad_small = find_page_quad(small)

    skew = 0.0
    if quad_small is not None:
        scale = img.shape[1] / small.shape[1]
        page = _warp(img, quad_small * scale)
        found = True
    else:
        page, found = img, False

    page = _resize_max(page, max_side)
    if not found:
        skew = estimate_skew(page)
        if abs(skew) > 0.3:
            page = _rotate(page, skew)
        else:
            skew = 0.0
    if flatten is None:
        flatten = illumination_variation(page) > ILLUMINATION_THRESHOLD
    if flatten:
        page = flatten_illumination(page)
    return PreparedPage(
        image=page, ocr_image=remove_table_lines(page), page_found=found, skew_deg=skew, flattened=bool(flatten)
    )
