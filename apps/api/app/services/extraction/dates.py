"""Data da coleta do laudo, lida do texto. So aceita data perto de uma palavra-chave de coleta:
nunca chuta a primeira data que aparece (poderia ser nascimento, impressao ou liberacao)."""
import re
from datetime import date

_KEY = (
    r"(?:data\s+d[aeo]\s+coleta|coleta|colhid[oa]|data\s+da\s+amostra|"
    r"collected|collection(?:\s+date)?|sample\s+date|specimen\s+date)"
)
_ISO = r"(?P<y1>\d{4})[-/.](?P<m1>\d{1,2})[-/.](?P<d1>\d{1,2})"
_BR = r"(?P<d2>\d{1,2})[-/.](?P<m2>\d{1,2})[-/.](?P<y2>\d{4})"
_RE = re.compile(rf"(?i){_KEY}\s*[:\-]?\s*(?:{_ISO}|{_BR})")


def find_collection_date(text: str) -> str | None:
    """Primeira data valida depois de uma palavra-chave de coleta, em ISO (yyyy-mm-dd); senao None."""
    for m in _RE.finditer(text):
        g = m.groupdict()
        y, mo, d = (g["y1"], g["m1"], g["d1"]) if g["y1"] else (g["y2"], g["m2"], g["d2"])
        try:
            return date(int(y), int(mo), int(d)).isoformat()
        except ValueError:
            continue
    return None
