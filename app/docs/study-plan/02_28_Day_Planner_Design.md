# 28-Day Multi-Task Planner - Algorithm Design

This document specifies the new daily-plan engine implemented in
`src/lib/dailyPlan.ts` (pure) and wired through `plannerLogic.ts`,
`PlannerContext`, and the dashboard UI. It builds on the strategy in
`01_Success_Strategy_Brainstorm.md`.

The engine is **pure and deterministic**: same state + same `today` always
produces the same plan (no randomness; all rotation is derived from the day
index). This keeps it testable and keeps the plan stable across refreshes.

---

## 1. Data model

```ts
export type StudyTaskType =
  | "learn"
  | "review"
  | "practice"
  | "formula-review"
  | "mixed-practice"
  | "light-review";

export type DailyTaskStatus = "planned" | "done" | "skipped";

export interface DailyStudyTask {
  id: string;            // stable: `${date}|${type}|${topicId ?? slot}`
  topicId?: string;
  title: string;
  section?: string;
  type: StudyTaskType;
  plannedMinutes: number;
  reason: string;        // short, supportive instruction
  status: DailyTaskStatus;
  noteUrl?: string;
}

export interface DailyStudyPlan {
  date: string;          // ISO yyyy-mm-dd
  dayName: string;
  isToday: boolean;
  dayMode: DayMode;      // normal | not-in-mood | family | travel | work
  studyMode: StudyMode;  // recurring weekday mode (Normal/Low Energy/Family/Rest)
  phase: "build" | "final-review";
  totalPlannedMinutes: number;
  doneMinutes: number;
  tasks: DailyStudyTask[];
  focusMessage: string;  // supportive headline for the day
  isRest: boolean;
  isSkipped: boolean;
}

export interface PlanCoverage {
  totalTopics: number;       // included topics
  coveredTopics: number;     // touched (hours>0 or status moved) or scheduled
  remainingTopics: number;
  weakRemaining: number;     // confidence <= 2, not done
  highPriorityRemaining: number;
}

export interface PlanTuning {
  lightDay: boolean;      // shrink + lighten today
  morePractice: boolean;  // add practice/mixed blocks
  moreReview: boolean;    // add review blocks
  focusWeak: boolean;     // bias selection to weak topics
  includeAll: boolean;    // push uncovered topics to the front harder
}
```

Persistence additions (whole-state, rides existing LocalStorage / export-import /
GitHub JSON sync):

- `PlannerState.taskStatus: Record<string, "done" | "skipped">` keyed by task id.
- `PlannerState.planTuning?: PlanTuning`.
- `StudyLogEntry.taskId?: string` so multiple tasks for the same topic on the
  same day are logged distinctly (learn vs practice) and undo is exact.

A topic-bound task marked **done** writes a `StudyLogEntry` (with `taskId`,
minutes, topic) and adds hours - so readiness, topic completed-hours, charts, and
"this week" all update through the existing pipeline. `taskStatus` records the
done/skip for general (topic-less) tasks and for fast UI lookup. Undo removes the
log entry, reverses the hours, and clears `taskStatus`.

---

## 2. Inputs the algorithm considers

- exam date -> `daysRemaining`, `phase` (final-review when `daysRemaining <=
  finalReviewDays`, default 7).
- all topics with planned hours, exam weight, tier, confidence, status, completed
  hours, readiness/priority (reused from existing scoring).
- per-day availability minutes + recurring `StudyMode` (Rest excluded).
- per-date `dayOverrides`: `mode` (day mode), `status` skipped, `topicId` pinned,
  `locked`, `plannedMinutes`.
- `taskStatus` (done/skipped tasks), `studyLog` (for freshness/coverage).
- `planTuning`.

---

## 3. Per-day budget

```
base = availability[weekday].minutes        (0 if StudyMode === Rest)
if dayMode !== normal: base = min(base, DAY_MODE_PLAN[mode].cap)
if override.plannedMinutes set: base = clamp(override.plannedMinutes, 0, avail)
if tuning.lightDay (today only): base = min(base, LIGHT_DAY_CAP=20)
Rest or override.status==='skipped' -> budget = 0 (no tasks)
```

The budget is the single source of truth for minutes. Blocks are sized to sum to
exactly the budget.

---

## 4. Day shape (which blocks, in order)

A "shape" is an ordered list of block specs. Each spec has a `type`, a `source`
pool (`new` | `review` | `weak` | `high` | `none`), a relative `weight`, and a
`minMinutes`. Topics are bound after the shape is chosen; minutes are distributed
last.

Selected by mode + phase + budget:

- **Rest / skipped**: no blocks.
- **Family** (cap 15): `[ light-review(review, w1) ]` - or none if budget < 10.
- **Travel** (cap 20): `[ formula-review(none), light-review(review) ]`. No
  learn/practice (mobile-friendly).
- **Not in mood** (cap 20): `[ review(review), formula-review(none) ]` - light,
  review-leaning, no heavy practice.
- **Work** (cap 30): `[ learn(new, high-priority), review(review) ]` - 1-2 compact
  blocks on the most important topic.
- **Normal, build phase**: scale by budget
  - `< 25`: `[ learn ]`
  - `25-44`: `[ learn, review ]`
  - `45-69`: `[ learn, review, practice ]`
  - `70-104`: `[ learn, learn, review, practice ]`
  - `>= 105`: `[ learn, learn, review, practice, mixed-practice ]`
  (a `formula-review` is swapped in for a practice block roughly every 3rd day for
  variety).
- **Normal, final-review phase**: `[ mixed-practice, formula-review, review(weak),
  review(high) ]`, scaled to budget; one `learn` is prepended only if uncovered
  topics still exist (never fully skip a topic).

Tuning overlays (applied to the chosen shape):
- `morePractice`: append one `practice`/`mixed-practice` block.
- `moreReview`: append one `review` block.
- `focusWeak`: convert one review block's source to `weak` and bias new-topic
  selection toward weak topics.
- `includeAll`: new-topic selection prefers uncovered topics even more strongly
  (and an extra `learn` block on big days).
- `lightDay`: forces the Family-like light shape regardless of mode.

Block count is capped at `MAX_BLOCKS = 6`. Single-block minutes are clamped to
sane maxima (learn 50, others 40) where the budget allows.

---

## 5. Topic selection

Built once per horizon, then consumed day by day (deterministic pointers):

- `newQueue`: topics eligible for new learning (`include !== No`, status not
  `done`/`skipped`, priority > 0), sorted **coverage-first** then by priority.
  `nextNew()` returns the next uncovered topic; once all are covered it returns
  the next by priority (allowing high-priority repeats).
- `reviewQueue`: `include !== No`, status not `skipped`, sorted by review score
  (examWeight x (0.6 + confidenceGap) x tierFactor x statusFactor). Review blocks
  rotate through the **top half** of this queue, so high-yield/weak topics recur.
- `weakQueue`: included, not done, confidence <= 2, sorted by examWeight.
- `highQueue`: included, not done, tier 1 (fallback tier 2), sorted by examWeight.
- A pinned/locked `override.topicId` always takes the day's first learn/review
  slot (manual override wins).

Freshness: a topic logged/scheduled in the last `SPACING_DAYS` (2) is skipped for
`new` selection unless it is the only option or it is high priority.

This yields the two required properties simultaneously:
1. **Every eligible topic appears at least once** (coverage-first new selection).
2. **High-weight and weak topics appear more often** (they also fill the daily
   review/practice/weak/high blocks, which rotate through the top of their pools).

---

## 6. Minute distribution

Given the ordered specs and the day budget:

```
weights = specs.map(s => s.weight)
raw     = budget * weight / sum(weights)
mins    = max(round(raw), s.minMinutes), clamped to per-type max
fix rounding: add/subtract the leftover (budget - sum(mins)) on the largest block
```

Guarantees `sum(task.plannedMinutes) === budget` exactly (asserted in tests).

---

## 7. Task identity, status, done/undo/skip

- `id = `${date}|${type}|${topicId ?? slotIndex}``. Stable across regenerations
  for topic-bound tasks; general blocks use their slot index.
- Status resolved from `taskStatus[id]` (and, for topic tasks, the presence of a
  matching `studyLog` entry by `taskId`).
- **Done** (`setTaskDoneIn`): set `taskStatus[id]='done'`; if `topicId`, append a
  `StudyLogEntry { date, topicId, taskId, minutes }` (idempotent by `taskId`) and
  add hours.
- **Undo** (`undoTaskIn`): clear `taskStatus[id]`; remove the matching log entry
  (by `taskId`) and reverse hours.
- **Skip** (`skipTaskIn`): set `taskStatus[id]='skipped'` (no hours). Skipped
  topics naturally resurface on later days because they are not marked done.

All actions run through `PlannerContext.update()`, so they auto-save to
LocalStorage and trigger the debounced GitHub push - no manual Sync needed.

---

## 8. Regenerate vs manual overrides

- The engine is pure/deterministic, so `Regenerate plan` (`regeneratePlanIn`)
  bumps a monotonic `planSeed` that the engine folds into its topic rotation.
  This reshuffles the auto-picked review / practice topics while preserving every
  manual decision: done items (study log + `taskStatus`), locked days, day modes,
  skipped days, pinned topics and planned minutes are all untouched. Bumping the
  seed is always a real state change, so Regenerate reliably re-renders, saves to
  LocalStorage and triggers the debounced GitHub push (it can never silently
  no-op). The separate `Clear manual changes` action (`clearWeekIn`) is the
  destructive reset that drops day overrides.
- Day mode, pinned topic, planned minutes, locked, and per-task done/skip are all
  honored on every rebuild. The engine reads them as inputs; it never discards a
  manual choice unless the user explicitly clears it.

---

## 9. Outputs wired into the model

`buildModel` adds:
- `todayStudyPlan: DailyStudyPlan` (today).
- `weekStudyPlans: DailyStudyPlan[]` (the visible week).
- `coverage: PlanCoverage`.

The existing `weeklyPlan`/`todayPlan` (single-topic) stay for the charts and
summary so nothing downstream breaks; charts read planned minutes from the new
day plans for consistency.

---

## 10. Supportive language

Focus messages and reasons use only supportive wording (today's target, suggested
load, steady progress, small steps count, keep going, light day, support mode).
No "behind", "late", "failing", "too slow". High pressure is communicated as
"several short blocks today to keep progress moving", never as a warning.

---

## 11. Constants (defaults, all tunable in code)

| Name | Value | Meaning |
|---|---|---|
| `FINAL_REVIEW_DAYS` | 7 | last-week switch to final-review shape |
| `LIGHT_DAY_CAP` | 20 | cap when "Light day" is on |
| `MAX_BLOCKS` | 6 | max tasks per day |
| `SPACING_DAYS` | 2 | min days before a topic repeats as `new` |
| learn/review/practice/formula/mixed/light base weights | 35/25/30/15/30/15 | block sizing |

---

## 12. Test plan (see `src/lib/dailyPlan.test.ts` and `planActions.test.ts`)

- All eligible topics appear at least once across a sufficient horizon.
- High-priority / weak topics appear strictly more often than a low one.
- Done topics are not scheduled as `learn`; can still appear in review/mixed.
- A day can have multiple tasks; `sum(minutes) === budget`; types are correct.
- Day modes: not-in-mood/family/travel/work produce the lighter/mobile/compact
  shapes and respect caps.
- Final-review phase contains mixed-practice + formula-review + review blocks.
- Task done/undo/skip persist; done writes a log entry + hours; undo reverses it.
- Hydrate restores `taskStatus`/`planTuning`; export/import round-trips them; the
  sync envelope includes them.
