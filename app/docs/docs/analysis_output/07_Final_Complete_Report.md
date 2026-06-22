# Final Complete Report — Technical Audit
## `Latifah_FE_Auto_Generated_Study_Planner.xlsx` + `Latifah_FE_Auto_Planner_Guide.pdf`

> Full technical audit produced by programmatic inspection (`openpyxl` for the workbook, `pypdf`/`pdfplumber` for the guide). **Originals were never modified** — all work was done on copies. The concept/idea explanation lives in `08_The_Idea_Explained.md`.

**Audit date:** 2026-06-20 · **Tooling:** Python `openpyxl 3.1.5`, `pypdf 6.13`, `pdfplumber 0.11`.

---

## 0. Executive snapshot

| Item | Finding |
|---|---|
| Product | Auto-generated study planner for the **FE Electrical & Computer** exam (85 topics, 17 sections, 150.5 planned hours) |
| Files | `.xlsx` (~53 KB) + `.pdf` guide (6 pages, text-based) — same author, same day (2026-05-18), same version |
| Sheets | 6 (3 visible, 3 hidden) |
| Formulas | 856 total · **0 error cells** |
| Automation | **None** — no VBA/macros, Office Scripts, Power Query, external links, pivots, or form controls |
| Protection | **None** — no workbook/sheet protection, no passwords |
| Overall | Smart, clean, usable; weakened by a broken Readiness metric, no protection, dead inputs, and a single-week horizon |
| Consistency | Workbook ↔ guide **largely consistent**, with **2 medium mismatches** |

---

## 1. Workbook Structure Audit

### 1.1 Sheets — status, purpose, counts
| # | Sheet | State | Purpose | Formulas | DV | CF | Merged | Protected |
|:-:|---|:--:|---|:--:|:--:|:--:|:--:|:--:|
| 1 | `Dashboard` | visible | KPI cockpit + essential inputs + daily availability + 4 charts | 54 | 3 | 16 | 100 | No |
| 2 | `Topic Planner` | visible | 85-topic data table + **priority engine** | 595 | 4 | 10 | 0 | No |
| 3 | `Weekly Plan` | visible | 7-day generated plan + manual tracking | 56 | 1 | 8 | 21 | No |
| 4 | `_Lists` | hidden | dropdown values + task templates | 0 | 0 | 0 | 0 | No |
| 5 | `_Calc` | hidden | aggregates, Top-5, chart source ranges | 39 | 0 | 0 | 0 | No |
| 6 | `_PlanEngine` | hidden | the 7-day plan builder | 112 | 0 | 0 | 0 | No |
| | **Total** | | | **856** | **8** | **34** | **121** | **0** |

- **Visible / hidden / very-hidden:** 3 / 3 / 0. The 3 engine sheets are `hidden` (not `veryHidden`) → any user can unhide them via right-click.
- **Main input sheets:** `Topic Planner` (topic ratings) + `Dashboard` (daily availability & inputs).
- **Main output sheets:** `Weekly Plan` + `Dashboard` cards/charts.
- **Supporting/config sheets:** `_Lists`, `_Calc`, `_PlanEngine`.
- Freeze panes: `Dashboard!A4`, `Topic Planner!H2`, `Weekly Plan!A6`. Hidden column `S` in `Topic Planner`; helper columns `T`,`U`,`V` are **visible with no headers**.

### 1.2 Protection (critical)
- **Workbook structure:** not locked (`lockStructure` off). **No password.** `DocSecurity = 0`.
- **Sheet protection:** `False` on all 6 sheets → every cell, including hidden-engine formulas, is freely editable/deletable.

### 1.3 Automation & content types
| Feature | Present? |
|---|:--:|
| VBA / Macros (`vbaProject.bin`) | ❌ No (file is `.xlsx`, not `.xlsm`) |
| Office Scripts / `customXml` | ❌ No |
| Power Query / connections / DataMashup | ❌ No |
| External workbook links | ❌ No |
| Pivot Tables / Pivot Cache | ❌ No |
| Form controls / ActiveX / Slicers | ❌ No |
| Charts | ✅ 4 (all on `Dashboard`) |
| Excel Tables (ListObjects) | ❌ **None** (uses Named Ranges + AutoFilter) |

> **Stated explicitly:** the workbook contains **no macros, VBA, Office Scripts, Power Query, or external links**. All logic is native formulas + Named Ranges + Conditional Formatting + Data Validation.

### 1.4 Tables & Named Ranges
- **Excel Tables: none.** An AutoFilter is defined on `Topic Planner!A1:R86` (`_xlnm._FilterDatabase`).
- **Named Ranges: 58 defined → 32 used by name, 26 unused (redundant).**
  - **Used (examples):** `PriorityKey` (52×), `TopicInclude` (23×), `TopicTier` (17×), `FamilyKey` (14×), `TopicName`/`TopicSection` (12×), `DailyMins`/`DailyEnergy`/`DailyMode`/`DayNames` (7× each), `WeeklyPlanTopic`, `WeeklyPlanDone`, `ProgressPct`, `ReadinessPct`, `WeeklyAvail`, `HighPriRem`, etc.
  - **Unused (26):** `DeferKey, FamilyTaskTemplates, OverallDone, OverallRem, PlanAutoTask, PlanAvailMins, PlanDate, PlanDay, PlanEnergy, PlanMode, PlanSuggestMins, PlanTopicIdx, PlanTopicName, PlanTopicSection, PlanTopicTier, PlannedHrs, StatusList, TiredKey, TopicAction, TopicBoredom, TopicDepth, TopicDiff, TopicProgress, TotalIncluded, WeeklyPlanActual, WeeklyPlanDate`.
  - The `Plan*` set is unused because `Weekly Plan` references `_PlanEngine` cells directly instead of via names.

### 1.5 Data Validation (8 ranges)
| Sheet | Range | List | Enforced? |
|---|---|---|:--:|
| Dashboard | `C23` | Flexible, Daily, Non-Daily (Study Style — *unused*) | soft |
| Dashboard | `H20:H26` | 1,2,3,4,5 (Energy) | soft |
| Dashboard | `I20:I26` | Normal, Low Energy, Family, Rest (Mode) | soft |
| Topic Planner | `A2:A86` | Yes, No, Later (Include?) | soft |
| Topic Planner | `G2:J86` | 1,2,3,4,5 (Confidence + Difficulty + Boredom + Quick Win) | soft |
| Topic Planner | `L2:L86` | Deep/Standard/Fast Review/Light Review/Skip Unless Time | soft |
| Topic Planner | `P2:P86` | Not Started … Exam Ready, Skipped | soft |
| Weekly Plan | `H6:H12` | Yes, No, Skipped (Done?) | soft |

- **All 8 have `showErrorMessage = False`** → dropdowns are provided but invalid typed/pasted values are **not rejected**, with **no input prompts or error alerts**.
- **No validation at all** on: `Daily Minutes (G20:G26)`, `Exam Date (C21)`, `Start Date (C22)`, `Completed Hrs (N)`, `Suggested Hrs (M)`, `Avg Wt (E)`, `Tier (F)`.

### 1.6 Conditional Formatting (34 rules)
Consistent traffic-light palette: red `F8CBAD`, amber `FFE699`, green `C6E0B4`, grey `D9D9D9`.
- **Dashboard (16):** Days Remaining (<14 red / <30 amber / ≥30 green), Progress & Readiness (<0.3 red / <0.6 amber), High-Priority Remaining (>10 red / >5 amber / ≤5 green), Energy color scale, Mode tint (Rest grey / Family pink / Low Energy cream), Done preview (Yes green / Skipped grey).
- **Topic Planner (10):** color scales on Priority `K`, Confidence `G`, Progress `O`; Status `P` tints; whole row grey when `Include=No`; **orange highlight when `AND(K≥5, Confidence≤2, Include=Yes)`** = high-value/low-confidence "high gain".
- **Weekly Plan (8):** Done tint, Mode tint, Capacity status (Under amber / Over red / Balanced green).
- Minor gap: no rule for `Not Started` / `Learning` statuses. No conflicting/duplicate rules.

---

## 2. Formula Audit

856 formulas. The only **volatile** function is `TODAY()` (7 uses); there is **no** `NOW`/`INDIRECT`/`OFFSET`/`RAND`/`RANDBETWEEN`. **Zero error cells** (`#REF!`/`#VALUE!`/`#DIV/0!`/`#N/A`) thanks to systematic `IFERROR` wrapping.

### 2.1 Key formulas by sheet

**`Topic Planner` — the scoring engine**
- Priority Score `K2` (recomputed per topic):
```
=IF(A2="No",0,IF(P2="Skipped",0,
  ROUND((E2*0.35+(6-G2)*0.25+J2*0.2+IF(F2=1,5,IF(F2=2,3,1))*0.15-I2*0.05)
        *IF(A2="Later",0.5,1)
        *IF(OR(IFERROR(N2/M2,0)>=1,P2="Exam Ready"),0.1,1),2)))
```
- Next Action `Q2` (thresholds 6 / 4.5 / 3):
```
=IF(A2="No","Skip for Now",IF(A2="Later","Defer",IF(OR(O2>=1,P2="Exam Ready"),"Keep Warm",
  IF(P2="Skipped","Skip for Now",IF(K2>=6,"Study Next",IF(K2>=4.5,"Study This Week",
  IF(K2>=3,"Practice","Review")))))))
```
- Progress `O2`: `=IFERROR(MIN(N2/M2,1),0)`
- Helper keys (columns `S:V`): `S=PriorityKey=K2+ROW()/100000`, `V=FamilyKey` (used), `T=TiredKey` & `U=DeferKey` (**defined but never used**).

**`_PlanEngine` — the 7-day builder**
- Week anchor `B2`: `=TODAY()-WEEKDAY(TODAY(),1)+1` (current Sunday), then `B3=B2+1`…
- Topic pick `J2`:
```
=IF(D2="Rest",0,IF(D2="Low Energy",0,
  IF(D2="Family",IFERROR(MATCH(LARGE(FamilyKey,I2),FamilyKey,0),0),
                 IFERROR(MATCH(LARGE(PriorityKey,G2),PriorityKey,0),0))))
```
- Suggested minutes `N2`: clamps per mode — Normal `MIN(45,MAX(25,E))`, Low Energy `MIN(20,MAX(10,E))`, Family `MIN(45,MAX(20,E))`.
- Auto-task text `O2`: builds the sentence from `NormalTaskTemplates`/`LowEnergyTasks` + topic name, or the "No included topics…" fallback.

**`_Calc` — aggregates & metrics**
- `B27 ProgressPct = =IFERROR(B25/B24,0)` (clean, linear).
- `B28 ReadinessPct = =IFERROR(SUMPRODUCT(TopicPriority,TopicCompleted)/SUMPRODUCT(TopicPriority,TopicHours),0)` (**flawed — see 2.5**).
- `B23 HighPriRem = =SUMPRODUCT((TopicPriority>=5)*(TopicInclude="Yes")*(TopicCompleted<TopicHours)*(TopicStatus<>"Exam Ready"))`.
- Top-5 `B15 = =INDEX(TopicName,MATCH(LARGE(PriorityKey,1),PriorityKey,0))` (+ score/section).

**`Dashboard` — countdown & "today"**
- `D5 Days Remaining = =C21-TODAY()` · `G5 Weeks = =ROUND((C21-TODAY())/7,1)`.
- Today's topic `E11 = =IF(INDEX(WeeklyPlanTopic,WEEKDAY(TODAY(),1))="","Rest day…",INDEX(WeeklyPlanTopic,WEEKDAY(TODAY(),1)))`.

### 2.2 Dependency flow
```
User inputs ─┬─ Topic Planner(A,G,H,I,J,N,P) ──► K (Priority) ──► S/V keys
             │                                         │
             └─ Dashboard(G20:I26, C21) ───────────────┤
                                                        ▼
                                   ┌─────────── _Calc (aggregates, Top-5, %s) ──► Dashboard cards + 4 charts
                                   └─────────── _PlanEngine (7-day) ──► Weekly Plan ──► Dashboard preview + "today"
```
One-directional, **no circular references, no external links**.

### 2.3 Volatile formulas
`TODAY()` × 7: `_PlanEngine!B2`; `Dashboard!D5, G5, A10, E11, E12, E13`. (`WEEKDAY` is not volatile.) Acceptable footprint; recalculates the week on each open/edit.

### 2.4 Hardcoded ranges & fragile formulas
- **Hardcoded extents:** every Named Range is fixed (`…$86` for topics, row 8 for the engine, row 12 for the week). **A topic typed in row 87 is not counted.** Because no Excel Table is used, ranges do not auto-grow.
- **Fragile on structural edits:** inserting/deleting rows inside engine sheets can desync the fixed cell references (`Weekly Plan` points at `_PlanEngine!B2…B8` literally). With no protection, accidental edits are likely.
- **`ROW()/100000` tiebreaker** keeps `LARGE`/`MATCH` keys unique — good defensive design.

### 2.5 Errors / risky formulas (with evidence)
- **No live errors** anywhere (0 error cells).
- **Risky #1 — `ReadinessPct` is non-monotonic.** Because a completed topic's priority collapses to 10%, its weight in both numerator and denominator shrinks, so the metric **severely understates progress and can drop when you finish a topic**. Measured on the real data:
  | % of hours done | Readiness shown |
  |:-:|:-:|
  | 45.5% | **11.23%** |
  | 81.1% | 40.79% |
  | 96.7% | 83.33% |

  Completing the #1 topic alone (99%→100%) moves Readiness from **1.84% → 0.19%** (−1.65 pts).
- **Risky #2 — `Days Remaining` goes negative** after the exam date (`=C21-TODAY()`, no guard).
- **Risky #3 — Suggested minutes can exceed availability** (`MAX(25,E)` raises a 15-min Normal day to 25; flagged by `TooMuch` but still displayed).
- **Edge case — fewer included topics than Normal days:** `LARGE(PriorityKey, n)` for large `n` can pick a near-zero (excluded) topic (rare with the default 85 topics).

---

## 3. PDF Guide vs Excel — Consistency Check

The guide (6 pages, text-only, no screenshots) and the workbook are the **same version** (same author/day), and agreement is very high.

### 3.1 What matches (verified)
| Guide claim | Workbook reality | Verdict |
|---|---|:--:|
| 3 sheets: Dashboard, Topic Planner, Weekly Plan | Exactly those visible sheets | ✅ |
| Top/second KPI card rows (12 cards) | `Dashboard!A4:P8`, identical names | ✅ |
| "What Should I Study Next?" 6 items | `A10:E16` | ✅ |
| Edit only 6 columns in Topic Planner | The 6 yellow columns A,G,I,N,P,R | ✅ |
| Next Action thresholds (≥6 / ≥4.5 / ≥3) | Matches `Q2` exactly | ✅ |
| Edit only Done?/Actual/Notes in Weekly Plan | `H,I,J` | ✅ |
| Mode lengths (25–45 / 10–20 / 20–45 / 0) | Matches `_PlanEngine!N` clamps | ✅ |
| Family never picks Tier 1; Low Energy = 6 rotating tasks | `FamilyKey` (`IF(F=1,0,…)`) + `LowEnergyTasks` (6) | ✅ |
| Week computed from `TODAY()`, Sunday start | `_PlanEngine!B2` | ✅ |
| **Daily Availability cheat sheet** (Sun 30/2 … Sat 45/4) | Matches defaults `G20:I26` **verbatim** | ✅ |
| **Postpone candidates:** Electromagnetics (Tier 3), 7.3 Laplace, 8.3 Digital Filters | Electromagnetics=Tier 3; Laplace & Digital Filters=Tier 2 | ✅ exact |
| **Never postpone Tier 1** (7 sections listed) | Those 7 sections are exactly the Tier-1 sections | ✅ exact |
| "No Arabic" | Workbook is English-only | ✅ |

### 3.2 What does NOT match (mismatches)
| # | Guide claim | Reality | Severity |
|:-:|---|---|:--:|
| 1 | "Essential Inputs: edit **name, exam date, start date, study style, weekly hour bounds**" | Only **Exam Date** is wired (countdown only); Name/Start Date/Study Style/Min/Max Weekly Hours feed **no formula** | **Medium** |
| 2 | "Exam Date → Days, Weeks Remaining, **all readiness math**" | Exam Date affects only `D5`/`G5`; it does **not** touch `ReadinessPct` or the plan | **Medium** |
| 3 | "Normal days rotate through **Tier 1/Tier 2** topics" | Engine ranks **all included tiers** by priority (a high-priority Tier 3 is eligible) | Minor |
| 4 | "never repeating the same topic twice in the same week" | True across Normal days; a topic **can** repeat on a Normal day and a Family day | Minor |

### 3.3 Missing documentation (in the guide)
- No mention that **3 hidden engine sheets** exist or that they must not be deleted/edited.
- No mention that there is **no protection**.
- Does not state the plan is a **rolling single week** (no full schedule to exam day).
- Does not warn that **Done?/Actual Min do not persist** across weeks (no history).
- **No screenshots/visuals**, despite targeting a non-technical user.

### 3.4 Undocumented workbook features (present but not in the guide)
- Helper columns `S:V` (`PriorityKey`, `TiredKey`, `DeferKey`, `FamilyKey`) — with `T`,`U`,`V` visible.
- `Recommended Depth (L)` dropdown (exists, but is not used by any formula and not explained).
- The `_Lists` task-template lists and the `FamilyTaskTemplates` range (the latter unused).
- The 26 unused Named Ranges.

**Verdict:** *Largely consistent, same version; two medium mismatches (dead "essential inputs" and the false "Exam Date drives all readiness math"), plus minor simplifications and documentation gaps. No evidence of version drift.*

---

## 4. Problems & Risks

**Count:** Critical 0 · High 2 · Medium 6 · Low 6 · Doc/UX 4.

| ID | Severity | Location | Problem | Impact | Recommended fix |
|:-:|:-:|---|---|---|---|
| H1 | **High** | `_Calc!B28` → `Dashboard!M5` | **Readiness Score is non-monotonic** (weights collapse to 10% when a topic completes) | Shows 11% at 45% done; can *drop* when finishing a topic; demotivating & misleading | Use a fixed weight: `=IFERROR(SUMPRODUCT(TopicWeight,(TopicInclude="Yes")*TopicCompleted)/SUMPRODUCT(TopicWeight,(TopicInclude="Yes")*TopicHours),0)` |
| H2 | **High** | Whole workbook | **No protection**; engine sheets only `hidden` | One accidental edit/delete breaks the plan silently | Lock all non-yellow cells + `Protect Sheet` (password); set engine sheets `veryHidden`; `Protect Workbook Structure` |
| M1 | Medium | `Dashboard!C20,C22,C23,C24,C25` | **Dead inputs** (Name, Start Date, Study Style, Min/Max Weekly Hrs) used by no formula | User edits them expecting effect → lost trust | Wire them in (see §5) or remove/label "display only" and fix the guide |
| M2 | Medium | `Dashboard!C21` ↔ `_PlanEngine` | **Exam Date does not drive the plan** (countdown only) | No pacing; topics may not be covered before exam | Add required-weekly-hours pacing + deficit alert (see §5) |
| M3 | Medium | `_PlanEngine`, `Weekly Plan` (7 rows) | **Single-week horizon**; no full schedule to exam | No long-term visibility | Generate an N-week roadmap to the exam date (see §5) |
| M4 | Medium | `Weekly Plan!H6:H12`, `I6:I12` | **Done?/Actual don't persist**; dates roll via `TODAY()` but entries stay | Stale data next week; "This Week" counter corrupted | Add a date-indexed history Log; reset/roll weekly (see §5) |
| M5 | Medium | All 8 DV rules | **Soft validation** (`showErrorMessage=False`) + missing validations | Invalid typed/pasted values silently break `COUNTIFS`/`IF` | Switch to `Stop` alerts + input messages; add numeric/date validation |
| M6 | Medium | `_PlanEngine!J`/`N`, `Topic Planner!M` | **One topic per day regardless of Suggested Hrs** | A 3-hour topic gets one ≤45-min session; heavy topics under-covered | Multi-session allocation: keep a topic until its hours are met |
| L1 | Low | `Topic Planner!T`,`U` (visible, unlabeled) | **Dead helper columns** `TiredKey`,`DeferKey` (170 unused formulas) | Mysterious numbers (e.g. `9.00002`) confuse users | Delete `TiredKey`/`DeferKey` or hide/relocate columns `T:V` |
| L2 | Low | Workbook defined names | **26 of 58 Named Ranges unused** | Maintenance clutter; hard to trace | Remove unused names or unify references |
| L3 | Low | `Dashboard!D5` | **Days Remaining goes negative** after exam | Illogical display | `=MAX(C21-TODAY(),0)` + "Exam passed" message |
| L4 | Low | `_PlanEngine!N` | **Suggested minutes can exceed availability** | Over-promises time | Cap suggestion at available minutes |
| L5 | Low | `Topic Planner!P` CF | **No color for `Not Started`/`Learning`** | Incomplete visual cue | Add two CF rules |
| L6 | Low | `_PlanEngine!J` | **Edge case:** included topics < Normal days picks excluded topics | Unintended topic shown (rare) | Guard: if key ≤ 0, show a generic review task |
| D1 | Doc/UX | PDF guide | Overstates dead inputs & "readiness math" | Misleads the user | Correct the guide or wire the inputs |
| D2 | Doc/UX | PDF guide | No mention of hidden sheets / no protection / single-week / no history | False expectations; risky edits | Add "How it works / Don't touch" + limitations section |
| D3 | Doc/UX | PDF guide | **No screenshots** for a non-technical user | Harder onboarding | Add annotated screenshots & examples |
| D4 | Doc/UX | `Topic Planner` H/J | Yellow/green convention not applied to Difficulty/Quick Win (which affect score and have dropdowns) | Conflicting signal about what to edit | Unify the visual signal + lock non-inputs |

---

## 5. Improvement Plan

Prioritized, actionable, with concrete Excel formulas. Quick wins first, then the structural features you requested.

### 5.1 Separate **Priority Score** from **Readiness Score** *(fixes H1)*
**Root cause:** `ReadinessPct` reuses `TopicPriority` (`K`), which is a *scheduling* signal that deliberately collapses to 10% when a topic is done. Reusing it for *readiness* conflates two different questions and makes readiness non-monotonic.

**Design — keep two independent measures:**
- **Priority Score (`K`)** → *what to study next*. Keep it dynamic (the `×0.1 / ×0.5 / 0` multipliers). No change.
- **Readiness Score** → *how ready am I for the exam*. Base it on a **static importance weight** (`TopicWeight`) × per-topic completion fraction (`TopicProgress`, which already = `MIN(N/M,1)` and is currently an *unused* named range):

```
Readiness% =
=IFERROR( SUMPRODUCT( TopicWeight, (TopicInclude="Yes"), TopicProgress )
        / SUMPRODUCT( TopicWeight, (TopicInclude="Yes") ), 0 )
```

This is **mastery-weighted coverage**: monotonic 0→100%, each topic contributes its exam importance × how far you've completed it. Optionally add a separate **Tier-1 Readiness** for exam-criticality:
```
=IFERROR( SUMPRODUCT(TopicWeight,(TopicTier=1),(TopicInclude="Yes"),TopicProgress)
        / SUMPRODUCT(TopicWeight,(TopicTier=1),(TopicInclude="Yes")), 0 )
```
Rename the cards clearly: **"Priority"** (scheduling) vs **"Readiness %"** (mastery).

### 5.2 Make **Exam Date** a real pacing driver *(fixes M2)*
Today Exam Date only feeds the countdown. Turn it into a pace controller in `_Calc`/`Dashboard`:
```
WeeksRemaining   = =MAX( (C21-TODAY())/7 , 0.1 )
RequiredWklyHrs  = =IFERROR( RemainingHrs / WeeksRemaining , 0 )
PaceStatus       = =IF( RequiredWklyHrs > WeeklyAvail,
                        "BEHIND: need "&ROUND(RequiredWklyHrs,1)&" h/wk vs "&WeeklyAvail&" h available",
                        "On track ("&ROUND(RequiredWklyHrs,1)&" h/wk needed)" )
```
- Add a Dashboard card + CF (red when behind).
- Optional **intensity scaling**: when behind, raise the Normal session cap (e.g., 45→60) and/or de-emphasize Tier 3 as the exam nears:
```
TierBonus' = IF(F=3, 1 * IF(WeeksRemaining<3, 0.3, 1), original)
```

### 5.3 Add a **long-term roadmap** until the exam date *(fixes M3)*
Add a new sheet **`Roadmap`** that distributes all included topics across the remaining weeks by priority and weekly capacity.

**Formula approach (no macros):**
1. Rank topics by `PriorityKey` (already unique).
2. Running cumulative of `Suggested Hrs` in priority order.
3. Assign each topic a week bucket from weekly capacity:
```
TopicWeekIndex = =CEILING( CumulativeHoursThroughTopic / WeeklyAvail , 1 )
```
4. List topics per week with `INDEX`/`MATCH` on the rank, and **reserve the last 1–2 weeks for review** (see 5.6).
This gives "Week 1: A, B; Week 2: C, D; … final weeks: review", plus a "topics that don't fit before exam" overflow warning when `TotalRemainingHrs > WeeksRemaining × WeeklyAvail`.

### 5.4 Add **missed-day rescheduling** *(fixes M6 partially; pairs with 5.5)*
Goal: a day with `Done?=No/Skipped` whose date is in the past should not silently vanish.
**Design — a backlog queue:**
- Derive a **Backlog** list = scheduled topics where `Done?≠Yes` and `Date < TODAY()` (from the history Log in 5.5).
- The engine's Normal-day pick consumes the **backlog first**, then falls back to `LARGE(PriorityKey, …)`:
```
TopicIdx = IF( BacklogCount>=NormalRank,
               INDEX(BacklogTopicIdx, NormalRank),
               MATCH(LARGE(PriorityKey, NormalRank-BacklogCount), PriorityKey, 0) )
```
- Add a **"Catch-up" day type** that pulls the oldest missed Tier-1 topic. Because true carry-over needs persistence, implement alongside the Log.

### 5.5 Add **study history / Log** *(fixes M4 + removes double entry)*
Add a sheet **`Log`** (an Excel **Table** so it auto-grows): `Date | Day | Mode | Topic | SuggestedMin | ActualMin | Done? | Notes`.
- Append one row per session (weekly "commit" step, or per day).
- **Single source of truth:** derive Completed Hours per topic *from the Log* instead of manual entry:
```
Topic Planner!N (Completed Hrs) = =SUMIFS(Log[ActualMin], Log[Topic], C2) / 60
```
- Enables **streaks**, **weekly-hours-over-time** charts, and the backlog in 5.4:
```
Streak = consecutive dates in Log with ActualMin>0 ending today
WeekHours(w) = =SUMIFS(Log[ActualMin], Log[Date], ">="&weekStart, Log[Date], "<="&weekEnd)/60
```
This turns `Done?/Actual` from disposable weekly cells into permanent history.

### 5.6 Improve **final-review-phase** logic *(new exam-readiness behavior)*
Today the engine cycles top-priority topics and drops finished ones to 10% forever — no consolidation phase and no spaced repetition.
**Design:**
- Define a flag: `InReviewPhase = =((C21-TODAY())<=14)` (last 2 weeks; make the window an input).
- **When in review phase**, change the engine to:
  - prefer **almost-there** topics (`Status` ∈ {Practicing, Improving}) with high `TopicWeight`,
  - switch Normal auto-tasks to **review language** (timed practice, mistake review) instead of new theory,
  - guarantee every Tier-1 topic gets at least one "Keep Warm" pass.
- **Spaced repetition:** instead of `×0.1` forever, give Strong/Exam-Ready topics a light review every N days:
```
ReviewDue = =IF(AND(P="Exam Ready", TODAY()-LastReviewed>=7), TRUE, FALSE)
```
so mastered topics resurface briefly rather than disappearing.

### 5.7 Improve **PDF guide clarity** *(fixes D1–D4)*
- **Correct the mismatches:** relabel/remove the dead inputs (Name, Start Date, Study Style, Min/Max Weekly Hrs); fix "Exam Date → all readiness math".
- **Add sections:** "How it works (3-layer model)", "Don't touch (hidden sheets, helper columns S:V)", and "Limitations" (single week today, manual logging, no history yet).
- **Add visuals:** annotated screenshots of the Dashboard, a worked example (e.g., logging 35 min on 6.6 Impedance), and a quick-start one-pager.
- **Add an Arabic version** (the user's first language) — or at least bilingual key steps.
- **Document new features** (Roadmap, Log, pacing, review phase) once added.

### 5.8 Phased rollout
| Phase | Items | Effort | Impact |
|---|---|:--:|:--:|
| **A — Quick wins** | 5.1 Readiness fix · H2 protection · L1/L2 cleanup · L3 negative-days guard · D1 guide fix | ~1 day | High |
| **B — Pacing & integrity** | 5.2 exam pacing · 5.5 Log + derived Completed Hrs · M5 hard validation · Topic Planner → Excel Table | ~2–4 days | High |
| **C — Advanced** | 5.3 roadmap · 5.4 missed-day reschedule · 5.6 review phase + spaced repetition · 5.7 full guide rewrite + Arabic | ~1–2 weeks | Transformative |

---

## 6. Technical Appendix (quick reference)
- **Sheets:** `Dashboard`(v) · `Topic Planner`(v) · `Weekly Plan`(v) · `_Lists`(h) · `_Calc`(h) · `_PlanEngine`(h).
- **Named ranges:** 58 (32 used / 26 unused). **Tables:** none (AutoFilter `Topic Planner!A1:R86`).
- **Validations:** 8 list rules, all soft (`showErrorMessage=False`).
- **Conditional formatting:** 34 rules (Dashboard 16 / Topic Planner 10 / Weekly Plan 8).
- **Charts:** 4 on Dashboard, sourced from `_Calc`.
- **Volatile:** `TODAY()` ×7. **Errors:** 0. **External links:** none. **Protection:** none.
- **Companion data:** `workbook_analysis_summary.json` / `.csv`.

*Produced by direct programmatic inspection of both files; no part was left un-inspected (Excel and PDF both parsed successfully). Originals untouched.*
