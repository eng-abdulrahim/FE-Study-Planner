# Planner logic

All logic is implemented as pure, testable functions in `src/lib/`. This document is the source of truth
for the formulas. Tests in `src/lib/*.test.ts` lock in the important behaviours.

---

## 1. Priority score — "what should I study next?"

File: `src/lib/priority.ts`

```
base =
    ExamWeight        * 0.35
  + (6 - Confidence)  * 0.25      // weaker confidence => higher priority
  + QuickWin          * 0.20
  + TierBonus         * 0.15      // Tier 1 = 5, Tier 2 = 3, Tier 3 = 1
  - Boredom           * 0.05

priority = round2( max( base * IncludeMultiplier * DoneMultiplier , 0 ) )
```

- **IncludeMultiplier**: `Yes = 1.0`, `Later = 0.5`, `No = 0`.
- **DoneMultiplier**: `0.1` if status is `done` **or** completed hours ≥ planned hours; otherwise `1.0`.
  This pushes finished topics out of the new-topic rotation while still allowing light spaced review.
- Returns **0** when `Include = No` or status = `skipped`.
- **Tie-breaking**: ranking sorts by priority (desc), then by the original workbook **row order** (`rowOrder`),
  so the order is always deterministic (no duplicate-ranking bug).

Confidence/boredom/quick-win are clamped to 1–5 before use.

---

## 2. Readiness score — "how ready am I for the exam?" (monotonic, fixed)

File: `src/lib/readiness.ts`

The Excel workbook reused the priority weighting for readiness, so finishing a high-priority topic could
make overall readiness **drop**. Here readiness is fully independent and **monotonic**.

**Static weight** (never changes with user edits, which is what guarantees monotonicity):

```
StaticWeight = ExamWeight + PlannedHours * 0.5
```

**Status → progress** (canonical status set; non-decreasing as you move forward). Status, confidence and
their labels come from one source of truth, `src/data/topicOptions.ts`; legacy saved values
(`Learning`, `Improving`, `Strong`, `Exam Ready`, ...) are migrated on load via `normalizeTopicStatus`:

| Status (value → label) | Progress |
| --- | --- |
| `not-started` → Not started | 0.00 |
| `studying` → Studying | 0.35 |
| `practicing` → Practicing | 0.65 |
| `reviewing` → Reviewing | 0.90 |
| `done` → Done | 1.00 |
| `skipped` → Skipped | 0.00 |

**Topic progress** (each input is non-decreasing, so the `max` is non-decreasing too):

```
HoursRatio       = clamp(CompletedHours / PlannedHours, 0, 1)
ConfidenceRatio  = clamp((Confidence - 1) / 4, 0, 1)        // 1 -> 0, 5 -> 1
combined         = 0.6 * HoursRatio + 0.4 * ConfidenceRatio
TopicProgress    = clamp( max( StatusProgress, combined ), 0, 1 )
```

**Overall readiness** (over included topics, `Include != No`):

```
OverallReadiness = Σ(StaticWeight * TopicProgress) / Σ(StaticWeight)     // 0..1
```

**Guarantees (covered by tests):** marking a topic `done`, increasing confidence, or increasing
completed hours can never reduce overall readiness.

---

## 3. Exam-date pacing — exam date drives the schedule

File: `src/lib/pacing.ts`

```
DaysRemaining       = max(0, examDate - today)          // never negative
WeeksRemaining      = DaysRemaining / 7
RemainingHours      = Σ max(PlannedHours - CompletedHours, 0)   over included topics
RequiredWeeklyHours = RemainingHours / max(WeeksRemaining, 1)
AvailableWeeklyHours= Σ daily minutes (non-Rest days) / 60
```

**Pace status (internal only):**

- **Ahead** — `AvailableWeeklyHours > RequiredWeeklyHours * 1.15`
- **On Track** — within ±15%
- **Behind** — `AvailableWeeklyHours < RequiredWeeklyHours * 0.85`
- **Exam Passed** — exam date is in the past (days are clamped to 0, never negative).

> Pace status is computed and kept on the model, but it is **not surfaced as user-facing text** (no
> "Behind schedule" badge or "Pace" card). The dashboard shows a supportive daily message instead — see
> `data/motivationalMessages.ts`. Keep pace internal; do not render it as discouraging wording.

Because `RequiredWeeklyHours = RemainingHours / WeeksRemaining`, the requirement **rises as the exam gets
closer** (fewer weeks for the same remaining work).

---

## 4. Weekly scheduler — rolling 7-day plan (inside the Dashboard)

File: `src/lib/scheduler.ts`

- The week starts on the configured **Week start day** (default **Sunday**) of the current week, so past days
  can show as **done** or **missed** and future days as **planned**.
- A session's suggested minutes: `min(availableMinutes, modeMax)` — it **never exceeds your availability** and
  **never exceeds the mode cap**. Rest days are always `0`.

**Modes & per-session limits:**

| Mode | Picks | Minutes (min–max cap) | Task |
| --- | --- | --- | --- |
| **Normal** | Highest-priority topic (backlog first) | 25–45 | concept + worked examples (rotates) |
| **Low Energy** | Easiest eligible topic | 10–20 | formula lookup / flashcards / mistake review (rotates) |
| **Family** | Easiest / lowest-stress topic (prefers non-Tier 1) | 20–45 | light review, no heavy problem solving |
| **Rest** | — | 0 | no study; never penalised |

- **No repeats**: a topic is not reused within the same week (a fallback allows a repeat only if there aren't
  enough eligible topics, so days are never empty).
- `Include = No` and `skipped` topics are excluded; `done` topics are excluded from new-topic days.
- **Final review phase** (`DaysRemaining ≤ reviewWindowDays`, default 14): the queue is re-ranked by a review
  score that favours **high exam weight**, **weak confidence**, **incomplete Tier 1**, and topics that are
  `not-started/studying/practicing`. `reviewing` topics weigh a little lower; `done` topics are included for
  **light** spaced review but weighted low so they don't dominate. Normal-day tasks switch to timed practice /
  redo-missed / no-notes recall.

### Missed-day / backlog

Two deterministic passes keep this simple and stable:

1. Assign all 7 days by priority and detect **missed** days (past, non-Rest, no study logged, had a topic).
2. Re-run, feeding those missed topics as **backlog** into upcoming **Normal** days (consumed before brand-new
   topics, and allowed to bypass the no-repeat rule).

Past-day assignment does not depend on the backlog, so there is no oscillation. Missed study resurfaces
instead of silently disappearing.

### Day modes — per-date real-life constraints

Files: `src/data/dayModes.ts`, `src/lib/dayOverrides.ts`. Stored in `PlannerState.dayOverrides[date]`.

A **day mode** explains why a single calendar day cannot follow the normal plan. It is **separate** from the
recurring per-weekday `StudyMode` (availability) and from a topic's `TopicStatus` (workflow). Setting a mode
only adjusts that one date: it shortens the session (never lengthens it) and swaps in a lighter task.

| Day mode | Max minutes | Today task | Past day with no log |
| --- | --- | --- | --- |
| **Normal** | (no change) | normal plan | **missed** → backlog |
| **Not in mood** | 20 | quick review / one short problem | **skipped** (soft) |
| **Family** | 15 | optional light / formula review | **skipped** (soft) |
| **Travel** | 20 | mobile review (notes / formulas) | **skipped** (soft) |
| **Work** | 30 | short focused session | **missed** → backlog |

- Suggested minutes become `min(baseMinutes, modeCap, availableMinutes)` — capped, never increased. A manual
  **planned-minutes** override (the stepper) is applied last and wins over the cap, still clamped to `[5,
  availableMinutes]`.
- **Soft miss:** a past Family / Travel / Not-in-mood day without a log is a gentle **skipped** (no red
  "Missed", not forced into the backlog). The topic keeps its priority and reschedules naturally. Work and
  Normal past days stay **missed** so their load moves forward.

### Weekly panel (`This week`) — light, one action + one menu

Files: `src/components/dashboard/WeeklyPlanPreview.tsx`, `WeeklyDayRow.tsx`, `DayActionsMenu.tsx`,
`TopicSearchList.tsx`, `MinutesStepper.tsx`, `TopicPicker.tsx`, `src/components/common/Popover.tsx`,
`src/lib/weekView.ts`, `src/lib/studyActions.ts`. The list is deliberately quiet: each row shows the day, topic
+ section, planned time, **one** primary button and **one** "More" menu.

- **Primary action** only: a planned day shows **Done** (logs the session + adds hours); a skipped day shows
  **Undo** (back to planned). Nothing else is inline.
- **Done days disappear** from the active list (`splitWeekByDone`) and collapse into a **"N completed this
  week"** section with a per-row **Undo** (removes the log + reverses the hours). The scheduler marks a day
  `done` whenever a study-log entry exists for that date, so Mark Done / Undo move rows between the two lists.
- **More** menu (one compact popover, two views — actions list + topic search, no nested popovers):
  - **Mode** select (Normal / Not in mood / Family / Travel / Work) — a small coloured badge shows on the row
    only when the mode is not Normal.
  - **Planned time** stepper (`−5 / +5`, clamped `[5, available]`); the weekly "planned hours" total updates
    live (summed from `suggestedMinutes`).
  - **Change topic** (searchable, section-filterable; pins the topic, `Clear override`), **Move to today**,
    **Skip / Unskip**, **Lock / Unlock day** (lock pins the current topic), **Reset day**.
- **Manage week** (header): **Regenerate week** clears overrides on *unlocked* days (locked days and logged Done
  survive); **Clear manual changes** removes every override for the visible week.

The scheduler only **reads** `dayOverrides`; regenerating the week never erases a locked day, a manual mode, a
pinned topic, or logged Done. Every change flows through `PlannerContext.update()`, so it saves to LocalStorage,
is included in export / import, and triggers the debounced GitHub auto-push. All overrides round-trip through
cloud sync.

### Marking a whole topic Done (Topics table)

Completion of an entire topic lives in the **Topics** table/cards via a reversible **Done** toggle
(`DoneToggle`), separate from a day's logged session above. Marking Done sets the topic `status` to `done`
(excluded from new-topic scheduling); toggling it off calls `reopenStatus` — back to **reviewing** if the topic
has logged hours, else **not-started** — so it re-enters planning. The toggle is a real button with
`aria-pressed`, persists via `setStatus`, and triggers the same debounced cloud auto-save.

---

## 5. Study log

Files: `src/state/PlannerContext.tsx`, `src/components/Dashboard/StudyLogCard.tsx`

- Each entry stores `{ id, date, topicId, topicName, mode, minutes, note? }`.
- You can **mark a day done** (logs the suggested session) or **add a manual entry**; entries can be deleted.
- **Completed hours model (documented choice):** each topic's `completedHours` is the single authoritative
  value used by priority, readiness and progress. Logging a session **also** adds its hours to that topic's
  `completedHours`; deleting/editing a log entry adjusts it back. You can still edit `completedHours` directly
  in the Topic Planner as an override/baseline (e.g. progress made before using the app).
- **Mark today as done** is idempotent: it won't double-count the same date + topic.
- The Dashboard shows **this week's** logged hours and the number of days logged.

---

## 6. Storage schema

File: `src/lib/storage.ts` — LocalStorage key **`latifah-fe-planner-v1`**.

```ts
PlannerState {
  version: number;                 // STORAGE_VERSION, for migrations
  examName: string;
  examDate: string;                // ISO yyyy-mm-dd
  dailyAvailability: DayAvailability[]; // 7 entries, indexed Sunday..Saturday
  topics: Record<topicId, {
    include, status, confidence, boredom, quickWin, difficulty,
    completedHours, noteUrl
  }>;
  studyLog: StudyLogEntry[];
  backlog: MissedEntry[];          // reserved (backlog is also derived per render)
  dayOverrides: Record<date, {     // per-date manual edits (modes + week controls)
    mode?, topicId?, status?, locked?, plannedMinutes?, movedToToday?, updatedAt
  }>;
  ui: { weekStartDay, reviewWindowDays };
  lastUpdatedAt: string | null;    // ISO timestamp of the last real DATA change (drives sync)
  lastSaved: string | null;        // ISO timestamp, updated on every LocalStorage write
}
```

**Loading is self-healing** (`hydrate`): start from the 85 default topics, overlay saved values, validate
enums (`include`, `status`, `mode`), clamp numbers to range, keep all known topics, drop unknown ids, and add
newly introduced topics with defaults. Invalid or corrupt data falls back to defaults rather than crashing.

**Import validation** (`validateImportedState`) requires a valid `examDate` and a `topics` object, and checks
that `studyLog` / `dailyAvailability` (if present) are arrays before applying.

**`lastUpdatedAt` vs `lastSaved` (important for sync):** `lastSaved` changes on *every* LocalStorage
write, including loading a backup. `lastUpdatedAt` changes **only when the user actually edits planner
data** — `PlannerContext.update` stamps it solely when the producer returns a *different* state object,
and `importState`/`hydrate` **preserve** the incoming value rather than re-stamping. This is what lets the
sync layer detect real changes without raising false conflicts on routine saves or pulls.

**Note-URL hardening:** `sanitizeNoteUrl` (in `validation.ts`) runs inside `hydrate`, so any imported or
cloud-pulled `noteUrl` that is not `http://` / `https://` (e.g. `javascript:`, `data:`, malformed) is
stripped — not just the values typed into the edit drawer.

---

## 7. Cloud sync (GitHub, optional)

Files: `src/config/syncConfig.ts`, `src/lib/syncEngine.ts`, `src/state/SyncContext.tsx`,
`src/lib/githubSync.ts`, `src/lib/syncMeta.ts`, `src/lib/syncEnvelope.ts`, `src/lib/autoPush.ts`,
`src/lib/syncStatus.ts`, `src/components/sync/SyncButton.tsx`.

LocalStorage stays the live/offline source of truth. Cloud sync is a thin layer on top that mirrors state
to **one fixed private GitHub repo** via the Contents API. There is no settings UI and **no prompts**:
saving and loading are both fully automatic.

- **Auto-save:** every planner change auto-pushes after a debounce.
- **Auto-load:** newer cloud data is pulled automatically on open, when the tab regains focus/visibility,
  and on a light interval — no click required.
- **Conflicts resolve themselves** ("newest wins"): if both sides changed, the side with the more recent
  `lastUpdatedAt` is kept. There is no conflict prompt.

The single header **Sync** button is just a manual force-sync / refresh; it is never *required*.

The orchestration lives in a framework-agnostic engine (`createSyncEngine`, `src/lib/syncEngine.ts`);
`SyncContext` is a thin React wrapper that injects GitHub/storage/state, drives the auto-load triggers,
and renders status. Keeping the engine pure is what makes the debounce, queue, loop-guard, newest-wins
resolution, and 409 retry behaviors unit-testable (`src/lib/syncEngine.test.ts`).

### Fixed configuration

`SYNC_CONFIG` (owner / repo / branch / path / token) is hardcoded in `src/config/syncConfig.ts`. The token
is **embedded in the bundle** (accepted personal/private-use tradeoff) and must be a fine-grained PAT scoped
to `eng-abdulrahim/private-data-store` with *Contents: Read and write* + *Metadata: Read-only*. Until the
`PASTE_GITHUB_TOKEN_HERE` placeholder is replaced, `isSyncConfigured()` is `false` and sync is inert.

### Envelope (`syncEnvelope.ts`)

The cloud file at `apps/fe-study-planner/planner-state.json` is plain JSON:

```json
{ "schemaVersion": 1, "appVersion": "1.0.0", "lastUpdatedAt": "ISO", "deviceId": "id", "state": { /* full planner state */ } }
```

`state` is exactly what `exportJson` produces, so a pull goes back through `importJson` → `hydrate` (the
same validation path as a manual import). The token is **never** part of the envelope.

### Decision (`syncMeta.decideSync`)

Per-device, non-secret bookkeeping lives under `latifah-fe-sync-meta`: `deviceId`, `lastSyncedAt`,
`lastKnownSha`, `lastSyncedLocalUpdatedAt`. The decision compares the file `sha` (cloud side) and
`lastUpdatedAt` (local side) against the last-synced snapshots — no cross-device clock comparison for the
*decision*:

| local changed | cloud changed | action |
| --- | --- | --- |
| no | no | **in-sync** (nothing written) |
| yes | no | **push** local → GitHub |
| no | yes | **pull** GitHub → local (via import/hydrate) |
| yes | yes | **conflict → auto-resolve (newest wins)** |

When both sides changed, the engine resolves it automatically with **no user action**: it reads the
cloud envelope's `lastUpdatedAt` and compares it with the local one. The more recently edited side wins —
cloud newer ⇒ **pull**, local newer (or a tie) ⇒ **push**. (ISO-8601 UTC timestamps compare
lexicographically, so this is a simple string comparison.) If the remote file is missing (404), the
current local state is used to create it.

### Auto-save (every planner action)

Every user mutation flows through `PlannerContext.update`, which bumps `lastUpdatedAt` only on a real
change. `SyncContext` watches `lastUpdatedAt` and calls `engine.onLocalChange()`, which schedules a
trailing debounce (`AUTO_PUSH_DEBOUNCE_MS = 4000`); rapid edits collapse into **one** push. The first run
on mount is skipped (opening the app makes no network call). Status during auto-save is **Saving... →
Saved** (manual Sync is **Syncing... → Synced**); the button label and spinner are shared.

### Auto-load (no user action)

`SyncContext` triggers a background `engine.autoLoad()` shortly after mount (`INITIAL_LOAD_DELAY_MS`), on
window `focus`/`visibilitychange`, and every `AUTO_LOAD_INTERVAL_MS = 60s`. A background load is **quiet**:
it shows no spinner and stays silent when already in sync, only surfacing a brief **Synced** when it
actually brings in newer cloud data. Because resolution is newest-wins, a poll while you are editing keeps
your in-progress local edits (local `lastUpdatedAt` is the most recent) and only replaces local data when
the cloud is genuinely newer.

The status button label and tone are computed by the pure `describeSyncButton` (`syncStatus.ts`): idle
`Sync`, syncing `Syncing...`, success `Synced`, error `Sync failed`.

### Engine safety properties

- **Loop guard (two layers):** after any successful sync, `lastSyncedLocalUpdatedAt` is set to the synced
  `lastUpdatedAt`, so `isDirty(...)` is immediately `false`. A pull additionally arms a one-shot
  `hydrating` flag so the change event from `importState` is swallowed and cannot start a push.
- **In-flight + single queue:** while a save is running, another *edit* sets `queued` instead of
  overlapping; when the save finishes, exactly one follow-up runs *if still dirty*. The pushed
  `lastUpdatedAt` is captured **before** the PUT, so edits made during a save stay dirty and are
  re-pushed by the queued follow-up (no silent data loss). Overlapping background loads simply no-op.
- **Conflict auto-resolution (newest wins):** a pre-flight `decideSync` conflict is resolved by comparing
  `lastUpdatedAt` and pushing or pulling accordingly — no prompt, no pause.
- **409 retry:** if the PUT returns **409/422** (the cloud moved between our GET and PUT), the engine
  re-fetches the current `sha` and resolves once more (push/pull by newest-wins). One retry handles the
  race; a repeated 409 surfaces a normal error (and only for manual/auto-save, never a background load).
- **Local-only fallback:** if the token is the placeholder/missing, `onLocalChange`, `autoLoad`, and
  `syncNow` do no network work (only a manual click reports that the token is missing); the app keeps
  working normally.

### Token hygiene

The token is read from `SYNC_CONFIG` only at call time and sent solely in the `Authorization: Bearer`
header. It is never stored in LocalStorage, never written into the synced JSON, never logged, and never
placed in a commit message or a user-facing error.
