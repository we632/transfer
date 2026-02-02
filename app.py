# app.py
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Tuple
import io
import re

# PDF
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ✅ 注册中文字体（放到 fonts/）
# 没有中文需求也可以去掉
try:
    pdfmetrics.registerFont(TTFont("NotoSansSC", "fonts/NotoSansSC-Regular.ttf"))
    PDF_FONT = "NotoSansSC"
except Exception:
    PDF_FONT = "Helvetica"

Lang = Literal["zh", "en", "es"]

I18N = {
  "zh": {
    "title": "转单记录",
    "add_row": "添加一行",
    "export_pdf": "导出 PDF",
    "from_date": "从哪天日期",
    "route": "线路",
    "from_driver": "原司机",
    "from_range": "包裹范围(如 100-120)",
    "to_date": "转到哪天日期",
    "to_driver": "新司机",
    "to_range": "转单范围(如 100-120)",
    "non_transferable": "不可转",
    "ops": "操作",
    "delete": "删除",
    "blocked_ranges": "不可转的包裹范围（可选）",
    "blocked_hint": "支持逗号分隔，例如：100-120, 205-210。系统会阻止与这些范围有重叠的转单。",
    "err_invalid_range": "范围格式错误：请使用 numbers-numbers（例如 100-120）。",
    "err_overlap_blocked": "第 {idx} 行：转单范围与不可转范围重叠，已阻止导出。",
  },
  "en": {
    "title": "Transfer Log",
    "add_row": "Add row",
    "export_pdf": "Export PDF",
    "from_date": "From date",
    "route": "Route",
    "from_driver": "From driver",
    "from_range": "Package range (e.g., 100-120)",
    "to_date": "To date",
    "to_driver": "To driver",
    "to_range": "Transfer range (e.g., 100-120)",
    "non_transferable": "Locked",
    "ops": "Actions",
    "delete": "Delete",
    "blocked_ranges": "Non-transferable ranges (optional)",
    "blocked_hint": "Comma-separated, e.g. 100-120, 205-210. Export is blocked if any transfer overlaps.",
    "err_invalid_range": "Invalid range format. Use numbers-numbers (e.g., 100-120).",
    "err_overlap_blocked": "Row {idx}: transfer range overlaps a blocked range. Export blocked.",
  },
  "es": {
    "title": "Registro de Transferencias",
    "add_row": "Agregar fila",
    "export_pdf": "Exportar PDF",
    "from_date": "Fecha origen",
    "route": "Ruta",
    "from_driver": "Conductor origen",
    "from_range": "Rango (ej. 100-120)",
    "to_date": "Fecha destino",
    "to_driver": "Conductor destino",
    "to_range": "Rango transferido (ej. 100-120)",
    "non_transferable": "Bloqueado",
    "ops": "Acciones",
    "delete": "Eliminar",
    "blocked_ranges": "Rangos no transferibles (opcional)",
    "blocked_hint": "Separados por comas, ej. 100-120, 205-210. Se bloquea si hay solapamiento.",
    "err_invalid_range": "Formato inválido. Use numbers-numbers (ej. 100-120).",
    "err_overlap_blocked": "Fila {idx}: el rango se solapa con uno bloqueado. Exportación bloqueada.",
  }
}

RANGE_RE = re.compile(r"^\s*(\d+)\s*-\s*(\d+)\s*$")

def parse_range(s: str) -> Optional[Tuple[int,int]]:
    m = RANGE_RE.match(s or "")
    if not m:
        return None
    a, b = int(m.group(1)), int(m.group(2))
    if a > b:
        a, b = b, a
    return (a, b)

def overlaps(r1: Tuple[int,int], r2: Tuple[int,int]) -> bool:
    return not (r1[1] < r2[0] or r2[1] < r1[0])

def parse_blocked_list(text: str) -> List[Tuple[int,int]]:
    out = []
    for part in (text or "").split(","):
        part = part.strip()
        if not part:
            continue
        r = parse_range(part)
        if r:
            out.append(r)
    return out

class Row(BaseModel):
    from_date: str
    route: str
    from_driver: str
    from_range: str
    to_date: str
    to_driver: str
    to_range: str
    locked: bool = False  # ✅ 方案A：行级“不可转/锁定”

class PdfPayload(BaseModel):
    lang: Lang = "zh"
    blocked_ranges: str = ""
    rows: List[Row] = Field(default_factory=list)

@app.get("/", response_class=HTMLResponse)
def lang_page(request: Request):
    return templates.TemplateResponse("lang.html", {"request": request})

@app.get("/form", response_class=HTMLResponse)
def form_page(request: Request, lang: Lang = "zh"):
    t = I18N.get(lang, I18N["zh"])
    return templates.TemplateResponse(
        "form.html",
        {"request": request, "lang": lang, "t": t, "t_json": t}
    )

@app.post("/pdf")
def export_pdf(payload: PdfPayload):
    t = I18N.get(payload.lang, I18N["zh"])

    blocked = parse_blocked_list(payload.blocked_ranges)

    # ✅ 校验
    for i, row in enumerate(payload.rows, start=1):
        tr = parse_range(row.to_range)
        if not tr:
            return JSONResponse({"ok": False, "msg": t["err_invalid_range"], "row": i}, status_code=400)

        # 方案A：行级锁定：locked=true 就不允许导出（或不允许提交）
        if row.locked:
            return JSONResponse({"ok": False, "msg": t["err_overlap_blocked"].format(idx=i), "row": i}, status_code=400)

        # 方案B：与“不可转范围”重叠就阻止
        for br in blocked:
            if overlaps(tr, br):
                return JSONResponse({"ok": False, "msg": t["err_overlap_blocked"].format(idx=i), "row": i}, status_code=400)

    # ✅ 生成 PDF
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle("transfer_log")
    c.setFont(PDF_FONT, 14)
    c.drawString(40, 760, t["title"])

    c.setFont(PDF_FONT, 10)
    y = 730
    headers = ["from_date","route","from_driver","from_range","to_date","to_driver","to_range"]
    header_labels = [t["from_date"], t["route"], t["from_driver"], t["from_range"], t["to_date"], t["to_driver"], t["to_range"]]

    # 简单表头
    x_positions = [40, 110, 170, 260, 360, 430, 510]
    for x, lab in zip(x_positions, header_labels):
        c.drawString(x, y, lab)
    y -= 14

    for row in payload.rows:
        if y < 60:
            c.showPage()
            c.setFont(PDF_FONT, 10)
            y = 760
        values = [row.from_date, row.route, row.from_driver, row.from_range, row.to_date, row.to_driver, row.to_range]
        for x, val in zip(x_positions, values):
            c.drawString(x, y, str(val)[:22])
        y -= 14

    c.showPage()
    c.save()
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=transfer_log.pdf"}
    )
