import csv
import os
from io import BytesIO, StringIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def utc_now_str():
    return datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")


def dicts_to_csv_bytes(rows, fieldnames=None) -> bytes:
    if not rows:
        # empty file with headers only
        if not fieldnames:
            fieldnames = ["empty"]
        out = StringIO()
        w = csv.DictWriter(out, fieldnames=fieldnames)
        w.writeheader()
        return out.getvalue().encode("utf-8")

    if not fieldnames:
        # union of keys
        keys = set()
        for r in rows:
            keys |= set(r.keys())
        fieldnames = sorted(keys)

    out = StringIO()
    w = csv.DictWriter(out, fieldnames=fieldnames)
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k, "") for k in fieldnames})
    return out.getvalue().encode("utf-8")


def save_csv(rows, out_path: str, fieldnames=None) -> str:
    ensure_dir(os.path.dirname(out_path))
    data = dicts_to_csv_bytes(rows, fieldnames=fieldnames)
    with open(out_path, "wb") as f:
        f.write(data)
    return out_path


def pdf_simple_table(
    title: str,
    subtitle: str,
    rows,
    columns,
    out_path: str,
):
    """
    Minimal clean PDF export using reportlab.
    rows: list of dicts
    columns: list of (key, label)
    """
    ensure_dir(os.path.dirname(out_path))

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    margin = 40
    y = height - margin

    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, y, title)
    y -= 18

    c.setFont("Helvetica", 10)
    c.drawString(margin, y, subtitle)
    y -= 18

    # header
    c.setFont("Helvetica-Bold", 9)
    x = margin
    col_width = (width - 2 * margin) / max(1, len(columns))

    for _, label in columns:
        c.drawString(x, y, str(label)[:28])
        x += col_width
    y -= 12

    c.setLineWidth(0.3)
    c.line(margin, y, width - margin, y)
    y -= 12

    # rows
    c.setFont("Helvetica", 9)
    for r in rows:
        if y < 80:
            c.showPage()
            y = height - margin
            c.setFont("Helvetica-Bold", 14)
            c.drawString(margin, y, title)
            y -= 18
            c.setFont("Helvetica", 10)
            c.drawString(margin, y, subtitle)
            y -= 18
            c.setFont("Helvetica-Bold", 9)
            x = margin
            for _, label in columns:
                c.drawString(x, y, str(label)[:28])
                x += col_width
            y -= 12
            c.line(margin, y, width - margin, y)
            y -= 12
            c.setFont("Helvetica", 9)

        x = margin
        for key, _label in columns:
            val = r.get(key, "")
            s = str(val)
            if len(s) > 28:
                s = s[:25] + "..."
            c.drawString(x, y, s)
            x += col_width
        y -= 12

    c.save()
    pdf_bytes = buf.getvalue()

    with open(out_path, "wb") as f:
        f.write(pdf_bytes)

    return out_path
