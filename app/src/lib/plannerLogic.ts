// Aggregation layer: turns raw PlannerState into everything the UI renders.
import type {
  ComputedTopic,
  DailyStudyPlan,
  DayPlan,
  PacingInfo,
  PlanCoverage,
  PlannerState,
  Tier,
  TopicStatus,
} from "../types/planner";
import { TOPICS } from "../data/topics";
import { ACTION_THRESHOLDS } from "../data/defaults";
import { STATUS_VALUES } from "../data/topicOptions";
import { computePriority, nextAction, remainingHours } from "./priority";
import { overallReadiness, readinessContribution, topicProgress } from "./readiness";
import { computePacing } from "./pacing";
import { buildWeeklyPlan, collectMissedTopicIds, findToday } from "./scheduler";
import { buildStudyPlan, computeCoverage } from "./dailyPlan";
import { computeAdaptivePlan } from "./adaptivePlan";
import type { AdaptivePlan } from "./adaptivePlan";
import { prepLevel } from "./labels";
import { addDays, clamp, daysBetween, parseISODate, toISODate, todayISO } from "./util";

export function computeTopics(state: PlannerState): ComputedTopic[] {
  return TOPICS.map((seed) => {
    const ts = state.topics[seed.id];
    return {
      seed,
      state: ts,
      priority: computePriority(seed, ts),
      remainingHours: remainingHours(seed, ts),
      progress: topicProgress(seed, ts),
      readinessContribution: readinessContribution(seed, ts),
      nextAction: nextAction(computePriority(seed, ts), ts, seed),
    };
  });
}

/**
 * The single source of truth for the dashboard's top summary cards. Every value
 * is derived from the SAME planner state in one place so the cards can never
 * drift apart: hours come from topic completedHours, days from the exam date,
 * preparation tracks hours-based study progress (completed / planned, the same
 * source as Completed and the Charts donut), and the weekly progress from the
 * multi-block plan the user actually sees in "This week". Hours are kept raw
 * (unrounded) here - formatting happens at the display edge (see lib/util).
 */
export interface PlannerSummary {
  /** Whole days until the exam, clamped to >= 0. `examPassed` when it is past. */
  daysRemaining: number;
  examPassed: boolean;
  /** Real completed study hours (sum of topic completedHours, capped at planned). */
  completedHours: number;
  plannedTotalHours: number;
  /** plannedTotalHours - completedHours, never below 0. */
  remainingHours: number;
  /** Study progress (completedHours / plannedTotalHours) as an integer percent
   *  (0..100), plus its supportive label. Starts at 0% and matches Completed. */
  preparationPercent: number;
  preparationLabel: string;
  /** This week's progress, measured in the study blocks shown in the weekly plan. */
  weeklyCompletedCount: number;
  weeklyTotalCount: number;
  weeklyCompletedMinutes: number;
}

export interface PlannerModel {
  computed: ComputedTopic[];
  byId: Map<string, ComputedTopic>;
  readiness: number; // 0..1
  progressPct: number; // 0..1 hours-based
  /** Canonical summary feeding the top cards (see PlannerSummary). */
  summary: PlannerSummary;
  pacing: PacingInfo;
  /** Adaptive "honest but gentle" target + mode for today (see lib/adaptivePlan). */
  adaptive: AdaptivePlan;
  weeklyPlan: DayPlan[];
  todayPlan: DayPlan | undefined;
  /** Multi-task daily plan (today first) + the rolling visible week. */
  studyPlan: DailyStudyPlan[];
  todayStudyPlan: DailyStudyPlan | undefined;
  weekStudyPlans: DailyStudyPlan[];
  coverage: PlanCoverage;
  reviewPhase: boolean;
  backlogTopicIds: string[];
  highPriorityCount: number;
  tierDistribution: Record<Tier, number>;
  statusDistribution: Record<TopicStatus, number>;
}

export function buildModel(state: PlannerState, today = todayISO()): PlannerModel {
  const computed = computeTopics(state);
  const byId = new Map(computed.map((t) => [t.seed.id, t]));
  const included = computed.filter((t) => t.state.include !== "No");

  const plannedTotalHours = included.reduce((s, t) => s + t.seed.plannedHours, 0);
  const completedHours = included.reduce(
    (s, t) => s + Math.min(t.state.completedHours, t.seed.plannedHours),
    0,
  );
  const remaining = Math.max(plannedTotalHours - completedHours, 0);

  const availableWeeklyHours =
    state.dailyAvailability
      .filter((d) => d.mode !== "Rest")
      .reduce((s, d) => s + d.minutes, 0) / 60;

  const weeklyPlan = buildWeeklyPlan({ state, computed, today });

  // ---- Adaptive target ----------------------------------------------------
  // Compute behaviour signals from the SAME state, derive the gentle/honest
  // target, then let it (only) raise today's budget so the plan ramps with real
  // momentum instead of sitting at the soft-start minutes forever.
  const rawDaysRemaining = daysBetween(today, state.examDate);
  const examPassed = rawDaysRemaining < 0;
  const adaptiveDaysRemaining = Math.max(rawDaysRemaining, 0);

  const coverageSignals = computeCoverage(computed);

  // Recent study consistency + stalls (study log is the source of truth).
  const windowStart = toISODate(addDays(parseISODate(today), -6)); // inclusive 7-day window
  const studyDates = new Set<string>();
  let lastStudyDate: string | null = null;
  for (const e of state.studyLog) {
    if (e.date > today) continue;
    studyDates.add(e.date);
    if (!lastStudyDate || e.date > lastStudyDate) lastStudyDate = e.date;
  }
  let recentActiveDays = 0;
  for (const d of studyDates) if (d >= windowStart && d <= today) recentActiveDays += 1;
  const daysSinceLastStudy = lastStudyDate ? daysBetween(lastStudyDate, today) : null;

  let recentSkips = 0;
  for (const [date, ov] of Object.entries(state.dayOverrides)) {
    if (ov.status === "skipped" && date >= windowStart && date <= today) recentSkips += 1;
  }

  // High-yield (Tier 1) coverage gap.
  let totalTier1 = 0;
  let untouchedTier1 = 0;
  for (const t of included) {
    if (t.seed.tier !== 1) continue;
    totalTier1 += 1;
    const touched =
      t.state.completedHours > 0 ||
      (t.state.status !== "not-started" && t.state.status !== "skipped");
    if (!touched) untouchedTier1 += 1;
  }

  const todayWeekday = parseISODate(today).getDay();
  const todayAvail = state.dailyAvailability[todayWeekday];
  const todayAvailabilityMinutes =
    todayAvail.mode === "Rest" ? 0 : Math.max(0, Math.round(todayAvail.minutes));

  const adaptive = computeAdaptivePlan({
    examPassed,
    daysRemaining: adaptiveDaysRemaining,
    remainingHours: remaining,
    completedHours,
    plannedTotalHours,
    todayAvailabilityMinutes,
    completedStudyDays: studyDates.size,
    recentActiveDays,
    daysSinceLastStudy,
    recentSkips,
    untouchedTier1,
    totalTier1,
    weakRemaining: coverageSignals.weakRemaining,
    remainingTopics: coverageSignals.remainingTopics,
    totalTopics: coverageSignals.totalTopics,
  });

  // Multi-task engine: builds the full remaining horizon (today first). The
  // adaptive recommended target gently raises today's budget (never lowers it).
  const { days: studyPlan, coverage } = buildStudyPlan({
    state,
    computed,
    today,
    todayBudgetMinutes: adaptive.recommendedMinutes,
  });
  const weekStudyPlans = studyPlan.slice(0, 7);
  const plannedWeeklyHours =
    weekStudyPlans.reduce((s, d) => s + d.totalPlannedMinutes, 0) / 60;

  const pacing = computePacing({
    examDate: state.examDate,
    today,
    plannedTotalHours,
    completedHours,
    remainingHours: remaining,
    availableWeeklyHours,
    plannedWeeklyHours,
  });

  const readiness = overallReadiness(computed);
  const progressPct = plannedTotalHours > 0 ? completedHours / plannedTotalHours : 0;

  const highPriorityCount = included.filter(
    (t) =>
      t.priority >= ACTION_THRESHOLDS.studyThisWeek &&
      t.state.status !== "done" &&
      t.state.status !== "skipped",
  ).length;

  const tierDistribution: Record<Tier, number> = { 1: 0, 2: 0, 3: 0 };
  for (const t of included) tierDistribution[t.seed.tier]++;

  const statusDistribution = Object.fromEntries(
    STATUS_VALUES.map((s) => [s, 0]),
  ) as Record<TopicStatus, number>;
  for (const t of computed) statusDistribution[t.state.status]++;

  // Canonical "This week" progress, measured against the multi-block plan the
  // user actually sees (weekStudyPlans). Done blocks come straight from the
  // task status, so the card moves the moment a block is marked Done / Undone
  // and stays consistent with the weekly view, regardless of the study log.
  let weeklyTotalCount = 0;
  let weeklyCompletedCount = 0;
  let weeklyCompletedMinutes = 0;
  for (const day of weekStudyPlans) {
    for (const task of day.tasks) {
      weeklyTotalCount += 1;
      if (task.status === "done") {
        weeklyCompletedCount += 1;
        weeklyCompletedMinutes += task.plannedMinutes;
      }
    }
  }

  // Preparation tracks hours-based study progress (same source as Completed and
  // the Charts "Overall progress" donut), so it starts at 0% and only moves as
  // study hours are logged - never from starting confidence alone.
  const prep = prepLevel(progressPct);
  const summary: PlannerSummary = {
    daysRemaining: pacing.daysRemaining,
    examPassed: pacing.examPassed,
    completedHours,
    plannedTotalHours,
    remainingHours: remaining,
    preparationPercent: clamp(Math.round(progressPct * 100), 0, 100),
    preparationLabel: prep.label,
    weeklyCompletedCount,
    weeklyTotalCount,
    weeklyCompletedMinutes: Math.round(weeklyCompletedMinutes),
  };

  return {
    computed,
    byId,
    readiness,
    progressPct,
    summary,
    pacing,
    adaptive,
    weeklyPlan,
    todayPlan: findToday(weeklyPlan),
    studyPlan,
    todayStudyPlan: studyPlan[0],
    weekStudyPlans,
    coverage,
    reviewPhase: pacing.daysRemaining >= 0 && pacing.daysRemaining <= state.ui.reviewWindowDays,
    backlogTopicIds: collectMissedTopicIds(weeklyPlan),
    highPriorityCount,
    tierDistribution,
    statusDistribution,
  };
}
