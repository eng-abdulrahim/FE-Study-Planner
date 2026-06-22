import zipfile, os, sys, json

path = r"_work/wb_copy.xlsx"
z = zipfile.ZipFile(path)
names = z.namelist()
print("=== ALL PARTS IN XLSX (OOXML ZIP) ===")
for n in sorted(names):
    info = z.getinfo(n)
    print(f"  {n}  ({info.file_size} bytes)")

print("\n=== FEATURE DETECTION ===")
checks = {
    "VBA macros (xl/vbaProject.bin)": any("vbaProject.bin" in n for n in names),
    "Office Scripts / customXml": any(n.startswith("customXml/") for n in names),
    "Power Query (xl/connections.xml)": any(n.endswith("connections.xml") for n in names),
    "Power Query (customXml item w/ DataMashup)": False,  # check below
    "Query Tables (xl/queryTables/)": any("queryTables/" in n for n in names),
    "External Links (xl/externalLinks/)": any("externalLinks/" in n for n in names),
    "Pivot Tables (xl/pivotTables/)": any("pivotTables/" in n for n in names),
    "Pivot Cache (xl/pivotCache/)": any("pivotCache/" in n for n in names),
    "Charts (xl/charts/)": any("charts/" in n for n in names),
    "Drawings (xl/drawings/)": any("drawings/" in n for n in names),
    "Slicers (xl/slicers/)": any("slicer" in n.lower() for n in names),
    "Form controls (xl/ctrlProps/)": any("ctrlProp" in n for n in names),
    "Shared strings": any(n.endswith("sharedStrings.xml") for n in names),
    "Calc chain (xl/calcChain.xml)": any(n.endswith("calcChain.xml") for n in names),
    "Tables (xl/tables/)": any("tables/" in n for n in names),
    "Threaded comments": any("threadedComment" in n for n in names),
    "Comments": any("comments" in n.lower() for n in names),
}
# Power Query DataMashup detection
for n in names:
    if n.startswith("customXml/") and n.endswith(".xml"):
        try:
            data = z.read(n).decode("utf-8", "ignore")
            if "DataMashup" in data or "Mashup" in data:
                checks["Power Query (customXml item w/ DataMashup)"] = True
        except Exception:
            pass

for k, v in checks.items():
    print(f"  {'YES' if v else 'no '}  {k}")

print("\n=== CONTENT TYPES ===")
try:
    print(z.read("[Content_Types].xml").decode("utf-8", "ignore"))
except Exception as e:
    print("err", e)

print("\n=== CORE PROPERTIES (docProps/core.xml) ===")
try:
    print(z.read("docProps/core.xml").decode("utf-8", "ignore"))
except Exception as e:
    print("no core props", e)

print("\n=== APP PROPERTIES (docProps/app.xml) ===")
try:
    print(z.read("docProps/app.xml").decode("utf-8", "ignore"))
except Exception as e:
    print("no app props", e)

print("\n=== workbook.xml ===")
try:
    print(z.read("xl/workbook.xml").decode("utf-8", "ignore"))
except Exception as e:
    print("err", e)

print("\n=== workbook.xml.rels ===")
try:
    print(z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "ignore"))
except Exception as e:
    print("err", e)
