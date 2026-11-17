# -*- coding: utf-8 -*-
"""把提示词 Markdown 转成可导入飞书的 Word 文档（标题层级 + 表格 + 代码块保留）。"""
import re
import sys
from docx import Document
from docx.shared import Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

CN_FONT = "Microsoft YaHei"
MONO_FONT = "Consolas"


def set_run_font(run, name, size=None, bold=None, color=None):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)
    rfonts.set(qn("w:eastAsia"), CN_FONT)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = RGBColor.from_string(color)


def shade(element, hexcolor):
    ppr = element.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hexcolor)
    ppr.append(shd)


INLINE_RE = re.compile(r"(\*\*.+?\*\*|`[^`]+?`)")


def shade_cell(cell, hexcolor):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hexcolor)
    tcpr.append(shd)


def add_inline(par, text, base_size=10.5, bold=False, color=None):
    for part in INLINE_RE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            add_inline(par, part[2:-2], base_size, True, color)
        elif part.startswith("`") and part.endswith("`") and len(part) > 2:
            run = par.add_run(part[1:-1])
            set_run_font(run, MONO_FONT, base_size - 1, bold, "B03060")
        else:
            run = par.add_run(part)
            set_run_font(run, CN_FONT, base_size, bold, color)


def add_code_block(doc, lines):
    for i, line in enumerate(lines):
        par = doc.add_paragraph()
        pf = par.paragraph_format
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
        pf.left_indent = Pt(12)
        if i == 0:
            pf.space_before = Pt(6)
        if i == len(lines) - 1:
            pf.space_after = Pt(6)
        shade(par._p, "F4F5F7")
        run = par.add_run(line if line else " ")
        set_run_font(run, MONO_FONT, 8.5)


def split_row(line):
    cells = re.split(r"(?<!\\)\|", line.strip())
    if cells and cells[0].strip() == "":
        cells = cells[1:]
    if cells and cells[-1].strip() == "":
        cells = cells[:-1]
    return [c.replace("\\|", "|").strip() for c in cells]


def add_table(doc, rows):
    header = split_row(rows[0])
    body = [split_row(r) for r in rows[2:]]
    ncols = len(header)
    table = doc.add_table(rows=1, cols=ncols)
    table.style = "Table Grid"
    table.autofit = True
    for i, text in enumerate(header):
        cell = table.rows[0].cells[i]
        cell.paragraphs[0].text = ""
        shade_cell(cell, "E8EEF7")
        add_inline(cell.paragraphs[0], text, base_size=9, bold=True)
    for row in body:
        cells = table.add_row().cells
        for i in range(ncols):
            text = row[i] if i < len(row) else ""
            cells[i].paragraphs[0].text = ""
            add_inline(cells[i].paragraphs[0], text, base_size=9)
    doc.add_paragraph()


def main(src, dst):
    with open(src, encoding="utf-8") as f:
        lines = f.read().split("\n")

    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = CN_FONT
    normal.font.size = Pt(10.5)
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), CN_FONT)
    normal.paragraph_format.space_after = Pt(4)
    normal.paragraph_format.line_spacing = 1.25

    i = 0
    first_heading = True
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            fence = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                fence.append(lines[i])
                i += 1
            i += 1
            add_code_block(doc, fence)
            continue

        if stripped.startswith("|"):
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i])
                i += 1
            if len(block) >= 2:
                add_table(doc, block)
            continue

        if not stripped:
            i += 1
            continue

        if stripped.startswith("---"):
            i += 1
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text = m.group(2)
            if first_heading and level == 1:
                doc.add_heading(text, level=0)
                first_heading = False
            else:
                doc.add_heading(text, level=min(level, 4))
            i += 1
            continue

        if stripped.startswith(">"):
            text = stripped.lstrip(">").strip()
            par = doc.add_paragraph()
            par.paragraph_format.left_indent = Pt(12)
            shade(par._p, "FFF8E1")
            add_inline(par, text, base_size=9.5, color="6B5B20")
            i += 1
            continue

        m = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        if m:
            indent = len(m.group(1))
            style = "List Bullet" if indent < 2 else "List Bullet 2"
            par = doc.add_paragraph(style=style)
            add_inline(par, m.group(2))
            i += 1
            continue

        m = re.match(r"^(\s*)\d+\.\s+(.*)$", line)
        if m:
            indent = len(m.group(1))
            style = "List Number" if indent < 2 else "List Number 2"
            par = doc.add_paragraph(style=style)
            add_inline(par, m.group(2))
            i += 1
            continue

        par = doc.add_paragraph()
        add_inline(par, stripped)
        i += 1

    doc.save(dst)
    print("saved:", dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
