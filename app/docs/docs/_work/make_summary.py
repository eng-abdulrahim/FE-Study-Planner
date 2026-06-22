import json, csv, os
rep = json.load(open(r"_work/xlsx_report.json", encoding="utf-8"))

sheet_rows = []
for s in rep["sheets"]:
    sheet_rows.append({
        "sheet": s["title"],
        "state": s["state"],
        "dimensions": s["dimensions"],
        "max_row": s["max_row"],
        "max_col": s["max_col"],
        "formulas": s["formula_count"],
        "data_validations": len(s["data_validations"]),
        "conditional_formats": len(s["conditional_formatting"]),
        "merged_cells": len(s["merged_cells"]),
        "error_cells": len(s["error_cells"]),
        "protected": s["protection"]["sheet"],
    })

used = {"CompletedHrs","DailyEnergy","DailyMins","DailyMode","DayNames","FamilyKey","HighPriRem","LowEnergyTasks","NormalTaskTemplates","PriorityKey","ProgressPct","ReadinessPct","RemainingHrs","TopicCompleted","TopicConf","TopicHours","TopicInclude","TopicName","TopicPriority","TopicQuickWin","TopicSection","TopicStatus","TopicTier","TopicWeight","WeeklyAvail","WeeklyPlanDay","WeeklyPlanDone","WeeklyPlanMins","WeeklyPlanMode","WeeklyPlanTask","WeeklyPlanTopic","WeeklyPlanned"}
all_names = [n for n in rep["defined_names"] if not n.startswith("_xlnm")]
unused = sorted(set(all_names) - used)

summary = {
    "analysis_meta": {
        "analyzed_files": [
            {"name": "Latifah_FE_Auto_Generated_Study_Planner.xlsx", "type": "Excel workbook (.xlsx)", "size_bytes": 53769},
            {"name": "Latifah_FE_Auto_Planner_Guide.pdf", "type": "PDF guide", "size_bytes": 208664, "pages": 6},
        ],
        "tooling": "Python openpyxl 3.1.5 (xlsx), pypdf 6.13 / pdfplumber (pdf)",
    },
    "workbook_properties": rep["properties"],
    "workbook_origin_path_hint": "E:\\FE\\Roadmap\\",
    "subject": "FE (Fundamentals of Engineering) Electrical & Computer exam study planner",
    "protection": {
        "workbook_structure_locked": bool(rep["security"].get("lockStructure")),
        "any_sheet_protected": any(s["protection"]["sheet"] for s in rep["sheets"]),
        "passwords": "none",
    },
    "automation": {
        "vba_macros": False, "office_scripts": False, "power_query": False,
        "external_links": False, "pivot_tables": False, "form_controls": False,
        "charts": 4, "tables_listobjects": 0, "autofilter": "Topic Planner!A1:R86",
    },
    "totals": {
        "sheets": len(rep["sheets"]),
        "visible_sheets": sum(1 for s in rep["sheets"] if s["state"]=="visible"),
        "hidden_sheets": sum(1 for s in rep["sheets"] if s["state"]=="hidden"),
        "very_hidden_sheets": sum(1 for s in rep["sheets"] if s["state"]=="veryHidden"),
        "total_formulas": rep["total_formulas"],
        "defined_names": len(all_names),
        "defined_names_used": len(used),
        "defined_names_unused": len(unused),
        "data_validation_ranges": sum(len(s["data_validations"]) for s in rep["sheets"]),
        "conditional_format_rules": sum(len(s["conditional_formatting"]) for s in rep["sheets"]),
        "error_cells": sum(len(s["error_cells"]) for s in rep["sheets"]),
        "topics": 85,
        "plan_horizon_days": 7,
    },
    "volatile_functions": {k: len(v) for k, v in rep["volatile_usage"].items()},
    "sheets": sheet_rows,
    "unused_named_ranges": unused,
    "dead_inputs": ["Dashboard!C20 Student Name","Dashboard!C22 Start Date","Dashboard!C23 Study Style","Dashboard!C24 Min Weekly Hours","Dashboard!C25 Max Weekly Hours"],
    "key_findings": [
        "Readiness Score (_Calc!B28) is non-monotonic and severely understates progress (11% readiness at 45% of hours).",
        "5 inputs (name, start date, study style, min/max weekly hours) are referenced by no formula (dead inputs).",
        "No workbook/sheet protection; the 3 engine sheets are only 'hidden' and easily breakable.",
        "26 of 58 named ranges are defined but never used by name.",
        "Plan is a rolling single 7-day week anchored on TODAY(); no full schedule to exam date, no reschedule of missed days.",
    ],
    "consistency_verdict": "Largely consistent and same-version; main mismatches: dead 'Essential Inputs' and the claim that Exam Date drives 'all readiness math'.",
}

os.makedirs("analysis_output", exist_ok=True)
with open(r"analysis_output/workbook_analysis_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

# CSV (sheet-level)
with open(r"analysis_output/workbook_analysis_summary.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(sheet_rows[0].keys()))
    w.writeheader()
    for r in sheet_rows:
        w.writerow(r)

print("Wrote analysis_output/workbook_analysis_summary.json and .csv")
print(json.dumps(summary["totals"], indent=2))
print("Unused named ranges:", len(unused))
