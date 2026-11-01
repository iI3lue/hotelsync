from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

ROOT = Path(__file__).resolve().parents[2]
DOCX = ROOT / "docs" / "HotelSync_Arquitectura_AS_BUILT.docx"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{edge}")
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), "BFBFBF")
        borders.append(element)
    tbl_pr.append(borders)
    width = OxmlElement("w:tblW")
    width.set(qn("w:w"), "5000")
    width.set(qn("w:type"), "pct")
    tbl_pr.append(width)
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "autofit")
    tbl_pr.append(layout)


def set_cell_margins(table):
    tbl_pr = table._tbl.tblPr
    margins = OxmlElement("w:tblCellMar")
    for side, value in (("top", 20), ("left", 80), ("bottom", 20), ("right", 80)):
        element = OxmlElement(f"w:{side}")
        element.set(qn("w:w"), str(value))
        element.set(qn("w:type"), "dxa")
        margins.append(element)
    tbl_pr.append(margins)


def style_table(table):
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table)
    set_cell_margins(table)

    for row_index, row in enumerate(table.rows):
        tr_pr = row._tr.get_or_add_trPr()
        cant_split = OxmlElement("w:cantSplit")
        tr_pr.append(cant_split)
        if row_index == 0:
            header = OxmlElement("w:tblHeader")
            tr_pr.append(header)

        for cell in row.cells:
            if row_index == 0:
                set_cell_shading(cell, "D9E2F3")
            for paragraph in cell.paragraphs:
                paragraph.style = "Table"
                paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
                paragraph.paragraph_format.space_before = Pt(0)
                paragraph.paragraph_format.space_after = Pt(0)
                paragraph.paragraph_format.line_spacing = 1.0
                paragraph.paragraph_format.first_line_indent = Pt(0)
                for run in paragraph.runs:
                    run.font.name = "Times New Roman"
                    run.font.size = Pt(9)
                    if row_index == 0:
                        run.font.bold = True
                        run.font.color.rgb = RGBColor(0x1F, 0x4D, 0x78)


def keep_table_together(table):
    for row in table.rows[:-1]:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.keep_with_next = True


def is_event_catalog(table):
    header = [cell.text.strip() for cell in table.rows[0].cells] if table.rows else []
    return header[:5] == ["Evento", "Productor", "Consumidores", "Cola(s)", "Efecto"]


def main():
    doc = Document(DOCX)
    for table in doc.tables:
        style_table(table)
        if len(table.rows) <= 15 and not is_event_catalog(table):
            keep_table_together(table)

    for paragraph in doc.paragraphs:
        if paragraph.style.name == "Image Caption":
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in paragraph.runs:
                run.font.name = "Times New Roman"
                run.font.size = Pt(10)
                run.font.italic = True

    props = doc.core_properties
    props.title = "HotelSync - Arquitectura AS-BUILT 2.0"
    props.subject = "Documento de arquitectura de software"
    props.author = "Juan Diego Diaz, Juan Pablo Hernandez, Maria Correa Soto, Marleidys Bautista"
    props.comments = "Version AS-BUILT al 30 de octubre de 2026"
    props.language = "es-CO"

    doc.save(DOCX)
    print(f"tables={len(doc.tables)} shapes={len(doc.inline_shapes)}")


if __name__ == "__main__":
    main()
