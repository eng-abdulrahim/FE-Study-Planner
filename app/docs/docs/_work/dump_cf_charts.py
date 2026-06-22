import openpyxl, json, re
from openpyxl.utils import get_column_letter

PATH = r"_work/wb_copy.xlsx"
wf = openpyxl.load_workbook(PATH, data_only=False)

# Differential styles (for CF dxf colors)
try:
    dxfs = wf._differential_styles.styles
except Exception:
    dxfs = []

def dxf_desc(dxfId):
    if dxfId is None or dxfId >= len(dxfs):
        return "(none)"
    d = dxfs[dxfId]
    parts = []
    if d.fill and d.fill.fgColor and d.fill.fgColor.rgb and d.fill.fgColor.rgb not in ("00000000",):
        parts.append(f"fill={d.fill.fgColor.rgb}")
    if d.fill and d.fill.bgColor and d.fill.bgColor.rgb and d.fill.bgColor.rgb not in ("00000000",):
        parts.append(f"bg={d.fill.bgColor.rgb}")
    if d.font and d.font.color and getattr(d.font.color,'rgb',None):
        parts.append(f"font={d.font.color.rgb}")
    if d.font and d.font.bold:
        parts.append("bold")
    return ", ".join(parts) if parts else "(style w/o color)"

print("################ CONDITIONAL FORMATTING (with colors) ################")
for ws in wf.worksheets:
    cfs = list(ws.conditional_formatting)
    if not cfs: 
        continue
    print(f"\n=== {ws.title} ===")
    for rng in ws.conditional_formatting:
        for rule in ws.conditional_formatting[rng]:
            extra = ""
            if rule.type in ("colorScale",) and rule.colorScale:
                cols = [c.rgb for c in rule.colorScale.color]
                extra = f" colors={cols}"
            if rule.type == "dataBar":
                extra = " (data bar)"
            if rule.type == "iconSet" and rule.iconSet is not None:
                extra = f" iconSet={rule.iconSet.iconSet}"
            print(f"  range={str(rng.sqref):<22} type={rule.type:<12} op={rule.operator} prio={rule.priority} dxf=[{dxf_desc(rule.dxfId)}] formula={list(rule.formula) if rule.formula else ''}{extra}")

print("\n################ CHARTS ################")
for ws in wf.worksheets:
    charts = getattr(ws, "_charts", [])
    if charts:
        print(f"\n=== {ws.title}: {len(charts)} chart(s) ===")
        for ch in charts:
            t = type(ch).__name__
            title = None
            try:
                if ch.title and ch.title.tx and ch.title.tx.rich:
                    title = "".join("".join(r.t for r in p.r if r.t) for p in ch.title.tx.rich.p if p.r)
            except Exception:
                title = None
            print(f"  type={t} title={title!r} anchor={getattr(ch,'anchor',None) and ch.anchor._from.__dict__ if hasattr(ch,'anchor') else '?'}")
            try:
                for s in ch.series:
                    val = s.val.numRef.f if (s.val and s.val.numRef) else (s.val.strRef.f if (s.val and s.val.strRef) else None)
                    cat = None
                    if s.cat:
                        cat = s.cat.strRef.f if s.cat.strRef else (s.cat.numRef.f if s.cat.numRef else None)
                    print(f"      series val={val} cat={cat}")
            except Exception as e:
                print("      (series read err)", e)

print("\n################ FULL NAMED-RANGE USAGE SCAN ################")
rep = json.load(open(r"_work/xlsx_report.json", encoding="utf-8"))
all_formulas_text = []
for s in rep["sheets"]:
    for fo in s["formulas"]:
        all_formulas_text.append(fo["formula"])
blob = "\n".join(all_formulas_text)
unused = []
used = []
for nm in sorted(rep["defined_names"].keys()):
    if nm.startswith("_xlnm"): 
        continue
    # count occurrences as a whole word
    cnt = len(re.findall(r"(?<![A-Za-z0-9_])" + re.escape(nm) + r"(?![A-Za-z0-9_])", blob))
    if cnt == 0:
        unused.append(nm)
    else:
        used.append((nm, cnt))
print(f"USED named ranges ({len(used)}):")
for nm, c in used:
    print(f"   {nm}: {c}")
print(f"\nUNUSED named ranges ({len(unused)}): {unused}")

print("\n################ VALIDATION showErrorMessage check ################")
for s in rep["sheets"]:
    for dv in s["data_validations"]:
        print(f"  {s['title']} {dv['sqref']}: showError={dv['showErrorMessage']} showInput={dv['showInputMessage']} errTitle={dv['errorTitle']!r}")
