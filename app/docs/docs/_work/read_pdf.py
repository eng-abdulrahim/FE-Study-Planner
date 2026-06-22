import sys
PATH = r"_work/guide_copy.pdf"

print("==================== pypdf extraction ====================")
try:
    from pypdf import PdfReader
    r = PdfReader(PATH)
    print("PAGES:", len(r.pages))
    meta = r.metadata
    print("METADATA:", dict(meta) if meta else None)
    for i, p in enumerate(r.pages):
        txt = p.extract_text() or ""
        print(f"\n--------- PAGE {i+1} (chars={len(txt)}) ---------")
        print(txt)
        # images on page
        try:
            imgs = list(p.images)
            if imgs:
                print(f"   [PAGE {i+1} has {len(imgs)} embedded image(s): {[im.name for im in imgs]}]")
        except Exception as e:
            print("   (image read err)", e)
except Exception as e:
    print("pypdf failed:", e)
