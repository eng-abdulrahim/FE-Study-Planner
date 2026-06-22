// Multi-task daily study engine. Turns the whole topic list + remaining days
// into a per-day plan made of several short, purpose-built blocks (learn /
// review / practice / formula / mixed / light). Pure and deterministic: the same
// state + `today` always yields the same plan (rotation is derived from order,
// never from Math.random), which keeps it testable and stable across refreshes.
//
// Design: docs/study-plan/02_28_Day_Planner_Design.md
import type {
  ComputedTopic,
  DailyStudyPlan,
  DailyStudyTask,
  DailyTaskStatus,
  DayMode,
  PlanCoverage,
  PlannerState,
  PlanTuning,
  StudyMode,
  StudyTaskType,
} from "../types/planner";
import { ACTION_THRESHOLDS, WEEKDAY_NAMES } from "../data/defaults";
import { DAY_MODE_PLAN, normalizeDayMode } from "../data/dayModes";
import { addDays, clamp, daysBetween, parseISODate, toISODate, todayISO } from "./util";

// ---- Tunable constants -----------------------------------------------------

export const FINAL_REVIEW_DAYS = 7; // last week -> final-review shape
export const LIGHT_DAY_CAP = 20; // minutes cap when "Light day" is on
export const MAX_BLOCKS = 6; // hard cap on tasks per day (burnout guard)
export const SPACING_DAYS = 2; // min days before a topic repeats as `new`
export const MAX_HORIZON = 60; // never build more than this many days ahead

// Per-block sizing: relative weight + min/max minutes.
const BLOCK_META: Record<StudyTaskType, { weight: number; min: number; max: number }> = {
  learn: { weight: 35, min: 15, max: 50 },
  review: { weight: 25, min: 10, max: 40 },
  practice: { weight: 30, min: 12, max: 40 },
  "formula-review": { weight: 15, min: 10, max: 30 },
  "mixed-practice": { weight: 30, min: 15, max: 45 },
  "light-review": { weight: 15, min: 10, max: 30 },
};

const REASON: Record<StudyTaskType, string> = {
  learn: "New topic. Learn the core idea, then try one example.",
  review: "Reinforce a key topic and close any gaps.",
  practice: "Solve a few FE-style problems to build speed.",
  "formula-review": "Refresh key formulas from the FE Handbook.",
  "mixed-practice": "Mixed FE-style questions across sections.",
  "light-review": "Light review - read notes or one worked example.",
};

const GENERAL_TITLE: Record<StudyTaskType, string> = {
  learn: "Study block",
  review: "Open review",
  practice: "Practice set",
  "formula-review": "Formula recap",
  "mixed-practice": "Mixed FE practice",
  "light-review": "Light review",
};

type Source = "new" | "review" | "weak" | "high" | "none";
interface BlockSpec {
  type: StudyTaskType;
  source: Source;
}

// ---- Eligibility + scoring (reuse the existing priority/readiness signals) --

function isNewEligible(t: ComputedTopic): boolean {
  return (
    t.state.include !== "No" &&
    t.state.status !== "skipped" &&
    t.state.status !== "done" &&
    t.priority > 0
  );
}

function isReviewEligible(t: ComputedTopic): boolean {
  return t.state.include !== "No" && t.state.status !== "skipped";
}

/** A topic has been "covered" once it has any hours or has moved past not-started. */
function isTouched(t: ComputedTopic): boolean {
  return t.state.completedHours > 0 || (t.state.status !== "not-started" && t.state.status !== "skipped");
}

function reviewScore(t: ComputedTopic): number {
  const tierFactor = t.seed.tier === 1 ? 1.5 : t.seed.tier === 2 ? 1.0 : 0.6;
  const confGap = (6 - clamp(t.state.confidence, 1, 5)) / 5;
  let statusFactor = 1.0;
  switch (t.state.status) {
    case "not-started":
    case "studying":
    case "practicing":
      statusFactor = 1.2;
      break;
    case "reviewing":
      statusFactor = 0.9;
      break;
    case "done":
      statusFactor = 0.4;
      break;
    default:
      statusFactor = 0;
  }
  return t.seed.examWeight * (0.6 + confGap) * tierFactor * statusFactor;
}

// ---- Minute distribution ---------------------------------------------------

/** Distribute a budget across blocks; result sums to `budget` whenever feasible. */
export function distributeMinutes(specs: readonly { type: StudyTaskType }[], budget: number): number[] {
  const n = specs.length;
  if (n === 0 || budget <= 0) return new Array(n).fill(0);
  const meta = specs.map((s) => BLOCK_META[s.type]);
  const wsum = meta.reduce((a, m) => a + m.weight, 0) || 1;

  const mins = meta.map((m) => Math.min(m.max, Math.max(m.min, Math.round((budget * m.weight) / wsum))));
  const order = [...Array(n).keys()].sort((a, b) => meta[b].weight - meta[a].weight);
  let total = mins.reduce((a, b) => a + b, 0);

  // Over budget: trim from the smallest-weight blocks down to their minimum.
  let guard = 0;
  while (total > budget && guard++ < 5000) {
    let changed = false;
    for (let k = n - 1; k >= 0 && total > budget; k--) {
      const i = order[k];
      if (mins[i] > meta[i].min) {
        mins[i]--;
        total--;
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Still over (budget smaller than the sum of minimums): trim below minimum too.
  guard = 0;
  while (total > budget && guard++ < 5000) {
    let changed = false;
    for (let k = n - 1; k >= 0 && total > budget; k--) {
      const i = order[k];
      if (mins[i] > 1) {
        mins[i]--;
        total--;
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Under budget: add to the largest-weight blocks up to their maximum.
  guard = 0;
  while (total < budget && guard++ < 5000) {
    let changed = false;
    for (let k = 0; k < n && total < budget; k++) {
      const i = order[k];
      if (mins[i] < meta[i].max) {
        mins[i]++;
        total++;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return mins;
}

// ---- Day shapes ------------------------------------------------------------

function baseShape(
  budget: number,
  dayMode: DayMode,
  phase: "build" | "final-review",
  hasUncovered: boolean,
  dayIndex: number,
): BlockSpec[] {
  if (budget <= 0) return [];

  if (dayMode === "family") {
    return budget < 10 ? [] : [{ type: "light-review", source: "review" }];
  }
  if (dayMode === "travel") {
    const s: BlockSpec[] = [{ type: "formula-review", source: "none" }];
    if (budget >= 18) s.push({ type: "light-review", source: "review" });
    return s;
  }
  if (dayMode === "not-in-mood") {
    const s: BlockSpec[] = [{ type: "review", source: "review" }];
    if (budget >= 16) s.push({ type: "formula-review", source: "none" });
    return s;
  }
  if (dayMode === "work") {
    const s: BlockSpec[] = [{ type: "learn", source: "new" }];
    if (budget >= 24) s.push({ type: "review", source: "review" });
    return s;
  }

  // Normal day.
  if (phase === "final-review") {
    const s: BlockSpec[] = [];
    if (hasUncovered) s.push({ type: "learn", source: "new" });
    s.push({ type: "mixed-practice", source: "none" });
    if (budget >= 35) s.push({ type: "formula-review", source: "none" });
    if (budget >= 55) s.push({ type: "review", source: "weak" });
    if (budget >= 80) s.push({ type: "review", source: "high" });
    return s;
  }

  // Normal build phase, scaled by the day's budget.
  let s: BlockSpec[];
  if (budget < 25) s = [{ type: "learn", source: "new" }];
  else if (budget < 45) s = [{ type: "learn", source: "new" }, { type: "review", source: "review" }];
  else if (budget < 70)
    s = [
      { type: "learn", source: "new" },
      { type: "review", source: "review" },
      { type: "practice", source: "high" },
    ];
  else if (budget < 105)
    s = [
      { type: "learn", source: "new" },
      { type: "learn", source: "new" },
      { type: "review", source: "review" },
      { type: "practice", source: "high" },
    ];
  else
    s = [
      { type: "learn", source: "new" },
      { type: "learn", source: "new" },
      { type: "review", source: "review" },
      { type: "practice", source: "high" },
      { type: "mixed-practice", source: "none" },
    ];

  // Variety: every 3rd day swap a practice block for a formula recap.
  if (dayIndex % 3 === 2) {
    const i = s.findIndex((b) => b.type === "practice");
    if (i >= 0) s[i] = { type: "formula-review", source: "none" };
  }
  return s;
}

function applyTuning(specs: BlockSpec[], tuning: PlanTuning): BlockSpec[] {
  let s = [...specs];
  if (tuning.includeAll && !s.some((b) => b.type === "learn")) {
    s.unshift({ type: "learn", source: "new" });
  }
  if (tuning.moreReview) s.push({ type: "review", source: "review" });
  if (tuning.morePractice) s.push({ type: "practice", source: "high" });
  if (tuning.focusWeak) {
    const i = s.findIndex((b) => b.type === "review");
    if (i >= 0) s[i] = { ...s[i], source: "weak" };
    else s.push({ type: "review", source: "weak" });
  }
  return s.slice(0, MAX_BLOCKS);
}

function focusFor(
  dayMode: DayMode,
  phase: "build" | "final-review",
  budget: number,
  blockCount: number,
  isToday: boolean,
  lightToday: boolean,
): string {
  if (lightToday && isToday) return "Light day - small steps still count.";
  switch (dayMode) {
    case "family":
      return "Family day. A few calm minutes still count.";
    case "travel":
      return "Travel day. Keep it light with formulas and notes.";
    case "not-in-mood":
      return "Low-energy day. Small steps still move you forward.";
    case "work":
      return "Busy day. One focused block keeps your momentum.";
    default:
      break;
  }
  if (phase === "final-review") return "Final review: practice, recall, and confidence.";
  if (budget >= 105 || blockCount >= 5)
    return "Today's target uses several short blocks to keep progress moving.";
  if (blockCount <= 1) return "Today's target: one focused block. Keep it simple.";
  return "Today's target: steady progress across a few short blocks.";
}

// ---- Coverage --------------------------------------------------------------

export function computeCoverage(computed: ComputedTopic[]): PlanCoverage {
  const included = computed.filter((t) => t.state.include !== "No");
  const covered = included.filter(isTouched).length;
  const weakRemaining = included.filter(
    (t) => t.state.status !== "done" && t.state.status !== "skipped" && t.state.confidence <= 2,
  ).length;
  const highPriorityRemaining = included.filter(
    (t) =>
      t.state.status !== "done" &&
      t.state.status !== "skipped" &&
      t.priority >= ACTION_THRESHOLDS.studyThisWeek,
  ).length;
  return {
    totalTopics: included.length,
    coveredTopics: covered,
    remainingTopics: Math.max(included.length - covered, 0),
    weakRemaining,
    highPriorityRemaining,
  };
}

// ---- Engine ----------------------------------------------------------------

export interface StudyPlanInput {
  state: PlannerState;
  computed: ComputedTopic[];
  today?: string;
  /** Number of days to build from `today`. Defaults to the days left to exam. */
  horizonDays?: number;
  /**
   * Adaptive ramp: when set, today's budget may grow toward this many minutes
   * (the recommended target from adaptivePlan). It only ever RAISES today's
   * budget above the configured availability - day-mode caps, light day, skip
   * and rest still apply - so a gentle soft-start day is left untouched.
   */
  todayBudgetMinutes?: number;
}

export interface StudyPlanResult {
  days: DailyStudyPlan[];
  coverage: PlanCoverage;
}

/** Build the multi-task plan for the whole remaining horizon (today first). */
export function buildStudyPlan(input: StudyPlanInput): StudyPlanResult {
  const today = input.today ?? todayISO();
  const { state, computed } = input;
  const tuning = state.planTuning;
  const byId = new Map(computed.map((t) => [t.seed.id, t]));

  const daysToExam = daysBetween(today, state.examDate);
  const horizon = clamp(
    input.horizonDays ?? (Number.isFinite(daysToExam) ? daysToExam + 1 : 7),
    7,
    MAX_HORIZON,
  );

  // Selection pools (built once, consumed across days).
  const newQueue = computed
    .filter(isNewEligible)
    .sort((a, b) => b.priority - a.priority || a.seed.rowOrder - b.seed.rowOrder);
  const reviewQueue = computed
    .filter(isReviewEligible)
    .sort((a, b) => reviewScore(b) - reviewScore(a) || a.seed.rowOrder - b.seed.rowOrder);
  const reviewTop = reviewQueue.slice(0, Math.max(1, Math.ceil(reviewQueue.length * 0.5)));
  const weakQueue = computed
    .filter((t) => isNewEligible(t) && t.state.confidence <= 2)
    .sort((a, b) => b.seed.examWeight - a.seed.examWeight || a.seed.rowOrder - b.seed.rowOrder);
  const highQueue = computed
    .filter((t) => isNewEligible(t) && t.seed.tier === 1)
    .sort((a, b) => b.seed.examWeight - a.seed.examWeight || a.seed.rowOrder - b.seed.rowOrder);

  // Topics already touched in saved state count as covered from day one.
  const scheduled = new Set<string>();
  for (const t of computed) if (isTouched(t)) scheduled.add(t.seed.id);

  // Last studied date per topic (spacing / freshness).
  const lastStudied = new Map<string, string>();
  for (const e of state.studyLog) {
    if (!e.topicId) continue;
    const prev = lastStudied.get(e.topicId);
    if (!prev || e.date > prev) lastStudied.set(e.topicId, e.date);
  }

  // The Regenerate action bumps `planSeed`; folding it into the rotation start
  // offsets reshuffles the auto-picked review / practice / weak / high topics on
  // each regenerate, while keeping the engine deterministic (a given seed always
  // yields the same plan). New-topic learning order stays priority-driven. With
  // the default seed 0 this is a no-op, so saved plans / tests are unchanged.
  const seed = Math.max(0, Math.floor(state.planSeed ?? 0));
  const reviewCtr = { v: seed };
  const weakCtr = { v: seed };
  const highCtr = { v: seed };

  const rotate = (pool: ComputedTopic[], c: { v: number }, used: Set<string>): ComputedTopic | null => {
    if (!pool.length) return null;
    for (let k = 0; k < pool.length; k++) {
      const t = pool[(c.v + k) % pool.length];
      if (!used.has(t.seed.id)) {
        c.v = (c.v + k + 1) % pool.length;
        return t;
      }
    }
    const t = pool[c.v % pool.length];
    c.v = (c.v + 1) % pool.length;
    return t;
  };

  const days: DailyStudyPlan[] = [];
  const start = parseISODate(today);

  for (let i = 0; i < horizon; i++) {
    const date = toISODate(addDays(start, i));
    const weekdayIndex = parseISODate(date).getDay();
    const avail = state.dailyAvailability[weekdayIndex];
    const studyMode: StudyMode = avail.mode;
    const override = state.dayOverrides[date];
    const dayMode = normalizeDayMode(override?.mode);
    const isToday = date === today;
    const isRest = studyMode === "Rest";
    const isSkipped = override?.status === "skipped";

    const dUntil = daysBetween(date, state.examDate);
    const phase: "build" | "final-review" =
      dUntil < 0 || (dUntil >= 0 && dUntil <= FINAL_REVIEW_DAYS) ? "final-review" : "build";

    // Budget.
    let budget = isRest ? 0 : Math.max(0, Math.round(avail.minutes));
    // Adaptive ramp (today only): grow toward the recommended target. Never
    // lowers the day; the caps below (day mode / light / skip) still win.
    if (isToday && !isRest && !isSkipped && input.todayBudgetMinutes != null) {
      budget = Math.max(budget, Math.max(0, Math.round(input.todayBudgetMinutes)));
    }
    if (dayMode !== "normal") budget = Math.min(budget, DAY_MODE_PLAN[dayMode].cap);
    if (override?.plannedMinutes != null) {
      budget = clamp(Math.round(override.plannedMinutes), 0, Math.max(0, Math.round(avail.minutes)));
    }
    const lightToday = isToday && tuning.lightDay;
    if (lightToday) budget = Math.min(budget, LIGHT_DAY_CAP);
    if (isSkipped) budget = 0;

    // Per-day topic selection (pinned/locked topic wins the first topic slot).
    const usedToday = new Set<string>();
    const pinnedId =
      override?.topicId && byId.has(override.topicId) && byId.get(override.topicId)!.state.status !== "done"
        ? override.topicId
        : null;

    // Topics already handled (done/skipped) on this date stay pinned to a slot of
    // the same type, so a finished block keeps showing as done (and stays
    // reversible) instead of being replaced when its hours mark it "covered".
    const handledByType: Partial<Record<StudyTaskType, string[]>> = {};
    const datePrefix = `${date}|`;
    for (const key of Object.keys(state.taskStatus)) {
      if (!key.startsWith(datePrefix)) continue;
      const rest = key.slice(datePrefix.length);
      const sep = rest.lastIndexOf("|");
      if (sep < 0) continue;
      const type = rest.slice(0, sep) as StudyTaskType;
      const tid = rest.slice(sep + 1);
      if (!byId.has(tid)) continue; // general (topic-less) tasks stay positional
      (handledByType[type] ??= []).push(tid);
    }

    const recentlyStudied = (t: ComputedTopic): boolean => {
      const ls = lastStudied.get(t.seed.id);
      if (!ls) return false;
      const gap = daysBetween(ls, date);
      return gap >= 0 && gap < SPACING_DAYS;
    };

    const nextNew = (): ComputedTopic | null => {
      const pick = (pred: (t: ComputedTopic) => boolean) =>
        newQueue.find((t) => !usedToday.has(t.seed.id) && pred(t)) ?? null;
      const ignoreFresh = tuning.includeAll;
      if (tuning.focusWeak) {
        const p = pick((t) => !scheduled.has(t.seed.id) && t.state.confidence <= 2 && (ignoreFresh || !recentlyStudied(t)));
        if (p) return p;
      }
      let p = pick((t) => !scheduled.has(t.seed.id) && (ignoreFresh || !recentlyStudied(t)));
      if (p) return p;
      p = pick((t) => !scheduled.has(t.seed.id));
      if (p) return p;
      p = pick((t) => !recentlyStudied(t));
      if (p) return p;
      return pick(() => true);
    };

    const pickTopic = (source: Source, type: StudyTaskType): ComputedTopic | null => {
      if (source === "none") return null;
      // Keep an already handled (done/skipped) block of this type in place. We do
      // NOT mark it globally "covered" here: a done topic is already covered via
      // its logged hours, while a skipped topic should stay eligible to be
      // rescheduled on a later day (it just remains visible/undoable on this one).
      const handled = handledByType[type];
      if (handled) {
        for (const tid of handled) {
          if (!usedToday.has(tid) && byId.has(tid)) {
            usedToday.add(tid);
            return byId.get(tid)!;
          }
        }
      }
      if (pinnedId && !usedToday.has(pinnedId)) {
        const t = byId.get(pinnedId)!;
        usedToday.add(t.seed.id);
        scheduled.add(t.seed.id);
        return t;
      }
      let t: ComputedTopic | null = null;
      if (source === "new") t = nextNew();
      else if (source === "review") t = rotate(reviewTop, reviewCtr, usedToday);
      else if (source === "weak") t = rotate(weakQueue.length ? weakQueue : reviewTop, weakCtr, usedToday);
      else if (source === "high") t = rotate(highQueue.length ? highQueue : reviewTop, highCtr, usedToday);
      if (t) {
        usedToday.add(t.seed.id);
        scheduled.add(t.seed.id);
      }
      return t;
    };

    // Shape -> minutes -> bound tasks.
    let tasks: DailyStudyTask[] = [];
    if (budget > 0 && !isRest && !isSkipped) {
      const hasUncovered = newQueue.some((t) => !scheduled.has(t.seed.id));
      let specs = lightToday
        ? baseShape(budget, "not-in-mood", phase, hasUncovered, i)
        : baseShape(budget, dayMode, phase, hasUncovered, i);
      if (dayMode === "normal" && !lightToday) specs = applyTuning(specs, tuning);
      specs = specs.slice(0, MAX_BLOCKS);

      const mins = distributeMinutes(specs, budget);
      const active = specs
        .map((spec, idx) => ({ spec, minutes: mins[idx], idx }))
        .filter((b) => b.minutes > 0);

      tasks = active.map(({ spec, minutes, idx }) => {
        const topic = pickTopic(spec.source, spec.type);
        const tid = topic ? topic.seed.id : `g${idx}`;
        const id = `${date}|${spec.type}|${tid}`;
        const status: DailyTaskStatus = state.taskStatus[id] ?? "planned";
        return {
          id,
          topicId: topic?.seed.id,
          title: topic ? topic.seed.topicName : GENERAL_TITLE[spec.type],
          section: topic?.seed.section,
          type: spec.type,
          plannedMinutes: minutes,
          reason: REASON[spec.type],
          status,
          noteUrl: topic?.state.noteUrl || undefined,
        };
      });
    }

    const totalPlannedMinutes = tasks.reduce((s, t) => s + t.plannedMinutes, 0);
    const doneMinutes = tasks
      .filter((t) => t.status === "done")
      .reduce((s, t) => s + t.plannedMinutes, 0);

    const focusMessage = isRest
      ? "Rest day. Recharge so your next session counts."
      : isSkipped
        ? "Day off from studying. Pick back up tomorrow."
        : budget <= 0
          ? "No time blocked today. Even five minutes counts."
          : focusFor(dayMode, phase, budget, tasks.length, isToday, lightToday);

    days.push({
      date,
      dayName: WEEKDAY_NAMES[weekdayIndex],
      isToday,
      dayMode,
      studyMode,
      phase,
      totalPlannedMinutes,
      doneMinutes,
      tasks,
      focusMessage,
      isRest,
      isSkipped,
    });
  }

  return { days, coverage: computeCoverage(computed) };
}
