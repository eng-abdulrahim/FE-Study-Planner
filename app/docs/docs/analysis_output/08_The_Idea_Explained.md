# The Idea Behind the Excel Planner
### `Latifah_FE_Auto_Generated_Study_Planner.xlsx`

> A concept-level explanation of *what the workbook is trying to do and how the idea is engineered*. For the technical audit (structure, formulas, risks, fixes) see `07_Final_Complete_Report.md`.

---

## 1. The core idea in one sentence
> **"Don't plan your studying — just rate your topics and tell me your free time, and I'll tell you exactly what to study today."**

The workbook turns a stressful, open-ended question ("With 85 FE-exam topics and limited time, what do I do *today*?") into a single automatic answer. The student never writes a schedule, never picks a topic manually, and never copies tasks around. They only **score topics and set daily availability**; the sheet does the prioritizing, scheduling, and tracking.

---

## 2. The design philosophy: "inputs light, outputs rich"
The whole product is built on one rule, printed at the top of the Dashboard and repeated in the guide:

- 🟡 **Yellow cells = you edit** (a handful of inputs + dropdowns).
- 🟢 **Green cells = the workbook fills them** (never type here).

This is a deliberate "calm software" idea: minimize decisions for a tired, busy student. The guide frames it as a **30-second daily ritual** — open Dashboard, read "What Should I Study Next?", do it, mark it done. Everything else recalculates by itself because the engine is driven by the volatile `TODAY()` function.

---

## 3. The mental model: a 3-layer machine
The 6 sheets are organized like a small application — **inputs → engine → outputs** — with the machinery hidden:

```
   INPUT LAYER (you)              ENGINE LAYER (hidden)            OUTPUT LAYER (you read)
 ┌───────────────────┐         ┌──────────────────────┐        ┌────────────────────────┐
 │ Topic Planner      │  ──►   │ _Calc  (aggregates,   │  ──►   │ Dashboard (cards,      │
 │  • rate 85 topics  │        │        Top-5, %s)      │        │   4 charts, "today")   │
 │ Dashboard inputs   │        │ _PlanEngine (7-day     │  ──►   │ Weekly Plan (the       │
 │  • daily Min/      │        │        builder)        │        │   7-day task list)     │
 │    Energy/Mode     │        │ _Lists (task templates)│        │                        │
 └───────────────────┘         └──────────────────────┘        └────────────────────────┘
```

| Layer | Sheets | Visible? | Role |
|---|---|---|---|
| Input | `Topic Planner`, `Dashboard` | yes | What you control |
| Engine | `_PlanEngine`, `_Calc`, `_Lists` | hidden | The "brain" — ~151 formulas |
| Output | `Weekly Plan`, `Dashboard` | yes | What you read |

The clever conceptual move: **separate the "brain" from the "face."** The user sees 3 clean sheets; 3 hidden sheets do the math.

---

## 4. The brain: a topic-priority scoring model
The heart of the idea is that **every one of the 85 topics earns a numeric Priority Score** each time anything changes. That score decides what gets studied first. Formula (`Topic Planner!K`):

```
Priority = ( ExamWeight×0.35
           + (6 − Confidence)×0.25      ← the weaker you are, the higher it ranks
           + QuickWin×0.20              ← reward fast, high-return topics
           + TierBonus×0.15             ← Tier1=5, Tier2=3, Tier3=1
           − Boredom×0.05 )             ← small penalty so you don't dread it
         × IncludeMultiplier            ← Yes 1.0 / Later 0.5 / No 0
         × DoneMultiplier               ← 0.1 once finished or "Exam Ready"
```

It blends **what matters for the exam** (weight, tier) with **where you personally need work** (low confidence), **what's efficient** (quick wins), and **what's pleasant** (boredom). Example from the actual file: `6.4 Waveform Analysis` scores **7.35** and becomes the global #1 topic; once you complete a topic, its score collapses to 10% so it drops out of rotation. This is the engine's way of saying *"study high-value things you're weak at, then stop drilling what you've mastered."*

---

## 5. The weekly engine: how one week is built
The plan is a **rolling 7-day window** anchored to the current week (Sunday start), rebuilt live from `TODAY()`. For each day the engine reads your Mode + Minutes + Energy and then:

1. **Ranks** the day among same-type days (1st Normal day, 2nd Normal day, …).
2. **Picks a topic** by rank: the *n*-th Normal day gets the *n*-th highest-priority topic → `LARGE(PriorityKey, n)`. So no topic repeats across Normal days in a week.
3. **Sets a session length**, clamped to the mode's limits.
4. **Writes a concrete task sentence**, e.g. *"Study the core concept, then solve 2-4 examples. Topic: 6.4 Waveform Analysis."*

A neat trick: each priority key has `+ROW()/100000` added, making every score unique so the `LARGE`/`MATCH` ranking never ties or errors out.

---

## 6. The human-centered part: energy & life-aware modes
This is what makes the idea feel like a *coach* rather than a spreadsheet. Each day is tagged with one of four **Modes**, and the engine adapts both the topic and the effort:

| Mode | Length | What it does | When |
|---|---|---|---|
| **Normal** | 25–45 min | Highest-priority topic, concept + 2–4 problems | Weekdays after work |
| **Low Energy** | 10–20 min | A light rotating task (formula lookup, flashcards…) — no specific topic | Tired evenings |
| **Family** | 20–45 min | Light review of an *easy* non-Tier-1 topic | Weekends |
| **Rest** | 0 | "Rest. No study required." — *never punished* | Whenever needed |

The idea: **protect the study streak by matching the workload to real life and energy**, instead of a rigid plan the student abandons after a bad day.

---

## 7. The feedback loop: it adapts as you progress
The planner is a closed loop. After studying you update three things in `Topic Planner` (Completed Hours, Status, Confidence). That immediately:
- lowers that topic's priority (so the engine moves on),
- recomputes Progress %, the Top-5 list, and the charts,
- reshapes **next** week's plan automatically.

So the plan isn't fixed — it's **semi-automatic**: generation is fully automatic, but the loop only closes if the student honestly logs progress.

---

## 8. The Dashboard: a single "daily answer" + cockpit
The Dashboard is meant to be the only thing you open daily. It shows:
- **Countdown & status cards:** Exam Date, Days/Weeks Remaining, Progress %, Readiness, Next Best Topic; then Completed/Remaining Hours, Weekly Available/Planned, High-Priority Remaining, "This Week X/7 done."
- **A red "What Should I Study Next?" box** that pulls *today's* exact topic, task, and length using `WEEKDAY(TODAY())`.
- **4 charts** (Overall Progress doughnut, Top-5 priority, Status breakdown, Weekly Hours).

The concept: a glanceable cockpit that answers *"am I on track, and what do I do right now?"*

---

## 9. The FE-specific intelligence: tiers & exam weighting
The idea is tailored to the real FE Electrical & Computer exam. All 85 topics carry an **exam weight** and a **Tier**:
- **Tier 1 (core scoring chapters):** Mathematics, Ethics, Engineering Economics, Circuit Analysis, Electronics, Power Systems, Digital Systems.
- **Tier 2:** Probability, Linear Systems, Signal Processing, Control, Communications, Computer Systems, Software Engineering.
- **Tier 3 (low yield):** Properties of Materials, Electromagnetics, Computer Networks.

This encodes exam strategy directly into the math: spend time where points and personal weakness overlap, and don't over-invest in low-yield chapters like Electromagnetics.

---

## 10. What the idea deliberately leaves out
By design (stated in the guide): **no question bank, no copy/paste, no manual task writing, no manual topic selection, and no Arabic** (the workbook is English-only). The philosophy is intentionally minimalist — "yellow cells in, green answers out."

---

## 11. Why the idea is good (conceptual strengths)
- **Removes decision fatigue** — one daily answer, zero planning effort.
- **Transparent, explainable logic** — every recommendation traces to a visible score.
- **Human-aware** — adapts to energy, family time, and rest without guilt.
- **Safe & self-contained** — pure native formulas (no macros), zero error cells.
- **Exam-strategic** — weights + tiers bake in "study what scores."

## 12. Where the idea stops (conceptual limits)
- It plans **one rolling week**, not a full roadmap to exam day — so the **exam date is only a countdown**, never a pacing driver.
- **Progress depends entirely on manual logging**; skip it and the loop never closes.
- **No long-term memory** — finished days and weekly history aren't stored.
- The **Readiness metric is conceptually flawed** (it understates progress because finished topics lose weight).

---

## 13. The essence
> It's a **personal, exam-aware study coach disguised as a spreadsheet**: you feed it your honest self-assessment and your real-life availability, and it converts a 150-hour, 85-topic mountain into a calm, adaptive, one-line daily instruction — *"here's what to study today, and for how long."*
