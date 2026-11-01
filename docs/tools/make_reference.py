from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[2]
SKELETON = ROOT / "docs" / "HotelSync_Arquitectura.docx"
TARGET = ROOT / "docs" / "tools" / "reference_as_built.docx"

BLUE = RGBColor(0x2E, 0x74, 0xB5)
DARK_BLUE = RGBColor(0x1F, 0x4D, 0x78)
GRAY = RGBColor(0x40, 0x40, 0x40)


def set_font(style, name="Times New Roman", size=None, bold=None, italic=None, color=None):
    font = style.font
    font.name = name
    font.size = Pt(size) if size else font.size
    if bold is not None:
        font.bold = bold
    if italic is not None:
        font.italic = italic
    if color is not None:
        font.color.rgb = color
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.get_or_add_rFonts()
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), name)


def set_paragraph(style, align=None, line=None, before=None, after=None, first_indent=None, keep_next=None, page_break=None):
    pf = style.paragraph_format
    if align is not None:
        pf.alignment = align
    if line is not None:
        pf.line_spacing = line
    if before is not None:
        pf.space_before = Pt(before)
    if after is not None:
        pf.space_after = Pt(after)
    if first_indent is not None:
        pf.first_line_indent = Inches(first_indent)
    if keep_next is not None:
        pf.keep_with_next = keep_next
    if page_break is not None:
        pf.page_break_before = page_break


def add_style(doc, name, base="Normal", kind=WD_STYLE_TYPE.PARAGRAPH):
    if name in [s.name for s in doc.styles]:
        return doc.styles[name]
    style = doc.styles.add_style(name, kind)
    if base:
        style.base_style = doc.styles[base]
    return style


def add_field(paragraph, instruction, placeholder="1"):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    begin.set(qn("w:dirty"), "true")
    run._r.append(begin)
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f" {instruction} "
    run._r.append(instr)
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    run._r.append(separate)
    text = OxmlElement("w:t")
    text.text = placeholder
    run._r.append(text)
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(end)


def bottom_border(paragraph):
    ppr = paragraph._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), "BFBFBF")
    pbdr.append(bottom)
    ppr.append(pbdr)


def main():
    doc = Document(SKELETON)

    normal = doc.styles["Normal"]
    set_font(normal, size=12)
    set_paragraph(normal, align=WD_ALIGN_PARAGRAPH.JUSTIFY, line=2.0, before=0, after=0)

    body = add_style(doc, "Body Text")
    set_font(body, size=12)
    set_paragraph(body, align=WD_ALIGN_PARAGRAPH.JUSTIFY, line=2.0, before=0, after=0, first_indent=0.5)

    first = add_style(doc, "First Paragraph")
    set_font(first, size=12)
    set_paragraph(first, align=WD_ALIGN_PARAGRAPH.JUSTIFY, line=2.0, before=0, after=0, first_indent=0.5)

    compact = add_style(doc, "Compact")
    set_font(compact, size=12)
    set_paragraph(compact, align=WD_ALIGN_PARAGRAPH.JUSTIFY, line=1.0, before=0, after=2, first_indent=0)

    table_text = add_style(doc, "Table")
    set_font(table_text, size=9)
    set_paragraph(table_text, align=WD_ALIGN_PARAGRAPH.LEFT, line=1.0, before=0, after=0, first_indent=0)

    image_caption = add_style(doc, "Image Caption")
    set_font(image_caption, size=10, italic=True, color=GRAY)
    set_paragraph(image_caption, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.0, before=6, after=12, first_indent=0)

    table_caption = add_style(doc, "Table Caption")
    set_font(table_caption, size=10, italic=True, color=GRAY)
    set_paragraph(table_caption, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.0, before=6, after=6, first_indent=0)

    figure = add_style(doc, "Figure")
    set_paragraph(figure, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.0, before=6, after=0, first_indent=0, keep_next=True)

    captioned = add_style(doc, "Captioned Figure")
    set_paragraph(captioned, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.0, before=6, after=0, first_indent=0, keep_next=True)

    for name in ("Cover University", "Cover Faculty", "Cover Title", "Cover Subtitle", "Cover Body", "Cover Date"):
        add_style(doc, name)

    cover_university = doc.styles["Cover University"]
    set_font(cover_university, size=14, bold=True, color=DARK_BLUE)
    set_paragraph(cover_university, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.15, before=110, after=6, first_indent=0)

    cover_faculty = doc.styles["Cover Faculty"]
    set_font(cover_faculty, size=12, color=GRAY)
    set_paragraph(cover_faculty, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.15, before=0, after=30, first_indent=0)

    cover_title = doc.styles["Cover Title"]
    set_font(cover_title, size=24, bold=True, color=DARK_BLUE)
    set_paragraph(cover_title, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.1, before=24, after=12, first_indent=0)

    cover_subtitle = doc.styles["Cover Subtitle"]
    set_font(cover_subtitle, size=14, italic=True, color=BLUE)
    set_paragraph(cover_subtitle, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.15, before=0, after=30, first_indent=0)

    cover_body = doc.styles["Cover Body"]
    set_font(cover_body, size=12)
    set_paragraph(cover_body, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.5, before=12, after=0, first_indent=0)

    cover_date = doc.styles["Cover Date"]
    set_font(cover_date, size=12, color=GRAY)
    set_paragraph(cover_date, align=WD_ALIGN_PARAGRAPH.CENTER, line=1.15, before=42, after=0, first_indent=0)

    h1 = doc.styles["Heading 1"]
    set_font(h1, size=16, bold=True, color=BLUE)
    set_paragraph(h1, align=WD_ALIGN_PARAGRAPH.LEFT, line=1.15, before=0, after=12, first_indent=0, keep_next=True, page_break=True)

    h2 = doc.styles["Heading 2"]
    set_font(h2, size=13, bold=True, color=BLUE)
    set_paragraph(h2, align=WD_ALIGN_PARAGRAPH.LEFT, line=1.15, before=14, after=6, first_indent=0, keep_next=True)

    h3 = doc.styles["Heading 3"]
    set_font(h3, size=12, bold=True, color=DARK_BLUE)
    set_paragraph(h3, align=WD_ALIGN_PARAGRAPH.LEFT, line=1.15, before=10, after=4, first_indent=0, keep_next=True)

    toc_heading = doc.styles["TOC Heading"]
    set_font(toc_heading, size=16, bold=True, color=BLUE)
    set_paragraph(toc_heading, align=WD_ALIGN_PARAGRAPH.LEFT, line=1.15, before=0, after=12, first_indent=0)

    toc1 = doc.styles["toc 1"]
    set_font(toc1, size=12, bold=True)
    set_paragraph(toc1, align=WD_ALIGN_PARAGRAPH.LEFT, line=1.0, before=4, after=2, first_indent=0)

    toc2 = doc.styles["toc 2"]
    set_font(toc2, size=11)
    set_paragraph(toc2, align=WD_ALIGN_PARAGRAPH.LEFT, line=1.0, before=0, after=1, first_indent=0.25)

    table_style = add_style(doc, "Table Grid", base=None, kind=WD_STYLE_TYPE.TABLE)
    tbl_pr = OxmlElement("w:tblPr")
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{edge}")
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), "BFBFBF")
        borders.append(element)
    tbl_pr.append(borders)

    section = doc.sections[0]
    section.different_first_page_header_footer = True

    header = section.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.text = "HotelSync - Documento de Arquitectura AS-BUILT 2.0"
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in hp.runs:
        run.font.name = "Times New Roman"
        run.font.size = Pt(9)
        run.font.color.rgb = GRAY
    bottom_border(hp)

    footer = section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    prefix = fp.add_run("Página ")
    for run in [prefix]:
        run.font.name = "Times New Roman"
        run.font.size = Pt(9)
        run.font.color.rgb = GRAY
    add_field(fp, "PAGE")
    middle = fp.add_run(" de ")
    middle.font.name = "Times New Roman"
    middle.font.size = Pt(9)
    middle.font.color.rgb = GRAY
    add_field(fp, "NUMPAGES")

    first_header = section.first_page_header
    first_header.is_linked_to_previous = False
    first_header.paragraphs[0].text = ""
    first_footer = section.first_page_footer
    first_footer.is_linked_to_previous = False
    first_footer.paragraphs[0].text = ""

    props = doc.core_properties
    props.title = "HotelSync - Arquitectura AS-BUILT 2.0"
    props.subject = "Documento de arquitectura de software"
    props.author = "Juan Diego Diaz, Juan Pablo Hernandez, Maria Correa Soto, Marleidys Bautista"
    props.comments = "Version AS-BUILT al 30 de octubre de 2026"
    props.language = "es-CO"

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    doc.save(TARGET)
    print(TARGET)


if __name__ == "__main__":
    main()
