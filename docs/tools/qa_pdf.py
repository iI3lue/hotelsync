import fitz

pdf = "docs/HotelSync_Arquitectura_AS_BUILT.pdf"
doc = fitz.open(pdf)
print(f"pages={len(doc)}")
issues = []
for i, page in enumerate(doc):
    text = page.get_text("text").strip()
    blocks = page.get_text("blocks")
    images = page.get_images(full=True)
    width, height = page.rect.width, page.rect.height
    xs0 = [b[0] for b in blocks]
    xs1 = [b[2] for b in blocks]
    ys0 = [b[1] for b in blocks]
    ys1 = [b[3] for b in blocks]
    label = f"p{i + 1}"
    if len(text) < 80 and not images:
        issues.append(f"{label}: nearly blank ({len(text)} chars)")
    if xs0 and min(xs0) < 60:
        issues.append(f"{label}: content starts at x={min(xs0):.1f}")
    if xs1 and max(xs1) > width - 60:
        issues.append(f"{label}: content ends at x={max(xs1):.1f} (width={width:.1f})")
    if ys1 and max(ys1) > height - 40:
        issues.append(f"{label}: content ends at y={max(ys1):.1f} (height={height:.1f})")
print("issues:")
for issue in issues:
    print(" -", issue)
print("--- first lines per page (1-8) ---")
for i in range(min(8, len(doc))):
    lines = [line for line in doc[i].get_text("text").splitlines() if line.strip()]
    print(i + 1, "|", " / ".join(lines[:4])[:220])
print("--- toc pages 2-4 ---")
for i in range(1, min(4, len(doc))):
    print(f"===== page {i + 1} =====")
    print(doc[i].get_text("text")[:2200])
for n in (1, 2, 4, 5, 6):
    page = doc[n - 1]
    pix = page.get_pixmap(dpi=110)
    pix.save(f"docs/tools/qa_fixed_page_{n}.png")
print("rendered qa_fixed_page_*.png")
