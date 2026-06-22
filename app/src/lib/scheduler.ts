// Weekly scheduler - builds the rolling 7-day plan shown inside the Dashboard.
import type {
  ComputedTopic,
  DayPlan,
  DayStatus,
  PlannerState,
  StudyMode,
} from "../types/planner";
import {
  LOW_ENERGY_TASKS,
  MODE_MINUTES,
  NORMAL_TASKS,
  REVIEW_TASKS,
  WEEKDAY_NAMES,
  familyTask,
  restTask,
} from "../data/defaults";
import { applyDayMode, isSoftMissDay, normalizeDayMode } from "../data/dayModes";
import { addDays, clamp, parseISODate, toISODate, todayISO } from "./util";

export interface SchedulerInput {
  state: PlannerState;
  computed: ComputedTopic[];
  today?: string;
}

/** Minutes for a session: never exceeds availability and never exceeds the mode cap. */
export function suggestMinutes(mode: StudyMode, availableMinutes: number): number {
  if (mode === "Rest" || availableMinutes <= 0) return 0;
  return Math.min(availableMinutes, MODE_MINUTES[mode].max);
}

/** Start date of the week that contains `today`, honouring the week-start setting. */
export function weekStartDate(today: string, weekStartDay: number): Date {
  const d = parseISODate(today);
  const back = (d.getDay() - weekStartDay + 7) % 7;
  return addDays(d, -back);
}

function isReviewPhase(daysRemaining: number, window: number): boolean {
  return daysRemaining >= 0 && daysRemaining <= window;
}

function familyScore(t: ComputedTopic): number {
  // Higher = easier / lower-stress, but still mildly favour weak topics.
  return (
    t.state.quickWin * 1.0 -
    t.state.difficulty * 0.5 -
    t.state.boredom * 0.5 +
    (6 - t.state.confidence) * 0.2
  );
}

function reviewScore(t: ComputedTopic): number {
  const tierFactor = t.seed.tier === 1 ? 1.5 : t.seed.tier === 2 ? 1.0 : 0.6;
  const confGap = (6 - t.state.confidence) / 5; // weaker confidence => higher
  let statusFactor = 1.0;
  switch (t.state.status) {
    case "not-started":
    case "studying":
    case "practicing":
      statusFactor = 1.2; // incomplete - needs the most review
      break;
    case "reviewing":
      statusFactor = 0.9;
      break;
    case "done":
      statusFactor = 0.4; // include for light spaced review, don't dominate
      break;
    default:
      statusFactor = 0; // skipped
  }
  return t.seed.examWeight * (0.6 + confGap) * tierFactor * statusFactor;
}

function eligibleForNew(t: ComputedTopic): boolean {
  return (
    t.state.include !== "No" &&
    t.state.status !== "skipped" &&
    t.state.status !== "done" &&
    t.priority > 0
  );
}

function eligibleForReview(t: ComputedTopic): boolean {
  return t.state.include !== "No" && t.state.status !== "skipped";
}

function pickUnused(queue: ComputedTopic[], used: Set<string>): ComputedTopic | null {
  for (const t of queue) if (!used.has(t.seed.id)) return t;
  return queue.length ? queue[0] : null; // fallback: allow a repeat rather than an empty day
}

interface AssignOptions {
  reviewPhase: boolean;
  logDates: Set<string>;
  today: string;
  backlogIds: string[];
}

function assign(
  state: PlannerState,
  computed: ComputedTopic[],
  opts: AssignOptions,
): DayPlan[] {
  const byId = new Map(computed.map((t) => [t.seed.id, t]));

  const normalQueue = [...computed]
    .filter(opts.reviewPhase ? eligibleForReview : eligibleForNew)
    .sort((a, b) =>
      opts.reviewPhase
        ? reviewScore(b) - reviewScore(a) || a.seed.rowOrder - b.seed.rowOrder
        : b.priority - a.priority || a.seed.rowOrder - b.seed.rowOrder,
    );

  const familyQueue = [...computed]
    .filter((t) => eligibleForNew(t) && t.seed.tier !== 1)
    .sort((a, b) => familyScore(b) - familyScore(a) || a.seed.rowOrder - b.seed.rowOrder);

  const used = new Set<string>();
  const backlogQueue = opts.backlogIds
    .map((id) => byId.get(id))
    .filter((t): t is ComputedTopic => !!t && eligibleForNew(t));

  const start = weekStartDate(opts.today, state.ui.weekStartDay);
  const plan: DayPlan[] = [];

  let normalTaskIdx = 0;
  let lowTaskIdx = 0;
  let reviewTaskIdx = 0;

  for (let i = 0; i < 7; i++) {
    const date = toISODate(addDays(start, i));
    const weekdayIndex = parseISODate(date).getDay();
    const avail = state.dailyAvailability[weekdayIndex];
    const mode = avail.mode;
    const availableMinutes = avail.minutes;
    const isPast = date < opts.today;
    const isToday = date === opts.today;

    // Per-date day mode / override (separate from the recurring StudyMode).
    const override = state.dayOverrides[date];
    const dayMode = normalizeDayMode(override?.mode);
    const explicitSkip = override?.status === "skipped";
    const overrideTopic =
      override?.topicId && byId.has(override.topicId) ? byId.get(override.topicId)! : null;

    let status: DayStatus;
    if (mode === "Rest") status = "rest";
    else if (explicitSkip) status = "skipped";
    else if (opts.logDates.has(date)) status = "done";
    // Family / Travel / Not-in-mood days are legitimate light days: a past one
    // without a log is a soft "skipped", never a harsh "missed" (so it is not
    // forced into the backlog). The topic stays high priority and reschedules.
    else if (isPast) status = isSoftMissDay(dayMode) ? "skipped" : "missed";
    else status = "planned";

    if (mode === "Rest") {
      plan.push({
        date,
        dayName: WEEKDAY_NAMES[weekdayIndex],
        weekdayIndex,
        mode,
        availableMinutes,
        energy: avail.energy,
        topicId: null,
        topicName: "Rest",
        section: null,
        tier: null,
        priority: null,
        suggestedMinutes: 0,
        task: restTask(),
        status,
        dayMode,
        noteUrl: "",
        isToday,
        fromBacklog: false,
      });
      continue;
    }

    // Explicit user skip: keep the pinned topic (if any) for context but plan
    // nothing. The topic is NOT consumed, so it remains available other days.
    if (explicitSkip) {
      plan.push({
        date,
        dayName: WEEKDAY_NAMES[weekdayIndex],
        weekdayIndex,
        mode,
        availableMinutes,
        energy: avail.energy,
        topicId: overrideTopic?.seed.id ?? null,
        topicName: overrideTopic?.seed.topicName ?? "Skipped",
        section: overrideTopic?.seed.section ?? null,
        tier: overrideTopic?.seed.tier ?? null,
        priority: overrideTopic?.priority ?? null,
        suggestedMinutes: 0,
        task: "Day skipped - no study planned.",
        status,
        dayMode,
        noteUrl: overrideTopic?.state.noteUrl ?? "",
        isToday,
        fromBacklog: false,
      });
      continue;
    }

    // A pinned (locked) topic always wins over the auto pick.
    let pick: ComputedTopic | null = overrideTopic;
    let fromBacklog = false;
    let task = "";

    if (mode === "Normal") {
      if (!pick && !isPast && backlogQueue.length) {
        pick = backlogQueue.shift() ?? null;
        fromBacklog = !!pick;
      }
      if (!pick) pick = pickUnused(normalQueue, used);
      if (opts.reviewPhase) {
        task = REVIEW_TASKS[reviewTaskIdx % REVIEW_TASKS.length];
        reviewTaskIdx++;
      } else {
        task = NORMAL_TASKS[normalTaskIdx % NORMAL_TASKS.length];
        normalTaskIdx++;
      }
    } else if (mode === "Family") {
      if (!pick) pick = pickUnused(familyQueue, used) ?? pickUnused(normalQueue, used);
      task = pick ? familyTask(pick.seed.topicName) : "Light review of any easy topic.";
    } else {
      // Low Energy
      if (!pick) pick = pickUnused(familyQueue, used) ?? pickUnused(normalQueue, used);
      task = LOW_ENERGY_TASKS[lowTaskIdx % LOW_ENERGY_TASKS.length];
      lowTaskIdx++;
    }

    if (pick) used.add(pick.seed.id);

    let suggested = suggestMinutes(mode, availableMinutes);
    if (!pick) {
      task = "All active topics are covered - do a light spaced review or rest.";
      suggested = mode === "Low Energy" ? suggested : Math.min(suggested, 20);
    }

    // Day mode (per date) shortens the session and swaps in a lighter task.
    if (dayMode !== "normal") {
      const adj = applyDayMode(suggested, availableMinutes, dayMode);
      suggested = adj.suggestedMinutes;
      task = adj.task;
    }

    // A pinned duration (rare) wins last, clamped to what's available.
    if (override?.plannedMinutes != null) {
      suggested = clamp(Math.round(override.plannedMinutes), 0, availableMinutes);
    }

    plan.push({
      date,
      dayName: WEEKDAY_NAMES[weekdayIndex],
      weekdayIndex,
      mode,
      availableMinutes,
      energy: avail.energy,
      topicId: pick?.seed.id ?? null,
      topicName: pick?.seed.topicName ?? "Open review",
      section: pick?.seed.section ?? null,
      tier: pick?.seed.tier ?? null,
      priority: pick?.priority ?? null,
      suggestedMinutes: suggested,
      task,
      status,
      dayMode,
      noteUrl: pick?.state.noteUrl ?? "",
      isToday,
      fromBacklog,
    });
  }

  return plan;
}

/** Past, non-rest study days with no log entry, that carried a topic. */
export function collectMissedTopicIds(plan: DayPlan[]): string[] {
  const ids: string[] = [];
  for (const d of plan) {
    if (d.status === "missed" && d.topicId && !ids.includes(d.topicId)) ids.push(d.topicId);
  }
  return ids;
}

/**
 * Build the 7-day plan. Two deterministic passes: pass 1 assigns by priority,
 * pass 2 re-runs feeding the missed topics from pass 1 as backlog into future
 * Normal days, so missed study resurfaces instead of silently disappearing.
 */
export function buildWeeklyPlan(input: SchedulerInput): DayPlan[] {
  const today = input.today ?? todayISO();
  const daysRemaining = Math.max(
    Math.round((parseISODate(input.state.examDate).getTime() - parseISODate(today).getTime()) / 86_400_000),
    -1,
  );
  const reviewPhase = isReviewPhase(daysRemaining, input.state.ui.reviewWindowDays);
  const logDates = new Set(input.state.studyLog.map((e) => e.date));

  const baseOpts: AssignOptions = { reviewPhase, logDates, today, backlogIds: [] };
  const pass1 = assign(input.state, input.computed, baseOpts);
  const missed = collectMissedTopicIds(pass1);
  if (!missed.length) return pass1;
  return assign(input.state, input.computed, { ...baseOpts, backlogIds: missed });
}

export function findToday(plan: DayPlan[]): DayPlan | undefined {
  return plan.find((d) => d.isToday);
}
