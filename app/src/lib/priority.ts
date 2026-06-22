// Priority score - answers "what should I study NEXT?".
// Re-implements the workbook priority formula (Topic Planner column K / _Calc).
import type { IncludeValue, TopicSeed, TopicState, TopicStatus, Tier } from "../types/planner";
import { ACTION_THRESHOLDS, TIER_BONUS } from "../data/defaults";
import { clamp, round2 } from "./util";

export function tierBonus(tier: Tier): number {
  return TIER_BONUS[tier] ?? 1;
}

export function includeMultiplier(include: IncludeValue): number {
  switch (include) {
    case "Yes":
      return 1;
    case "Later":
      return 0.5;
    case "No":
      return 0;
  }
}

/**
 * Done / status multiplier. A topic that is Done (or has all planned hours
 * completed) is strongly de-prioritised (~0.1) so it drops out of the new-topic
 * rotation but can still appear for light spaced review.
 */
export function doneMultiplier(
  status: TopicStatus,
  completedHours: number,
  plannedHours: number,
): number {
  const hoursDone = plannedHours > 0 && completedHours / plannedHours >= 1;
  if (status === "done" || hoursDone) return 0.1;
  return 1;
}

/**
 * Priority =
 *   ( ExamWeight*0.35 + (6-Confidence)*0.25 + QuickWin*0.20
 *     + TierBonus*0.15 - Boredom*0.05 )
 *   * IncludeMultiplier * DoneMultiplier
 * Returns 0 when Include = No or status = Skipped.
 */
export function computePriority(seed: TopicSeed, state: TopicState): number {
  if (state.include === "No" || state.status === "skipped") return 0;

  const confidence = clamp(state.confidence, 1, 5);
  const base =
    seed.examWeight * 0.35 +
    (6 - confidence) * 0.25 +
    clamp(state.quickWin, 1, 5) * 0.2 +
    tierBonus(seed.tier) * 0.15 -
    clamp(state.boredom, 1, 5) * 0.05;

  const result =
    base *
    includeMultiplier(state.include) *
    doneMultiplier(state.status, state.completedHours, seed.plannedHours);

  return round2(Math.max(result, 0));
}

export function remainingHours(seed: TopicSeed, state: TopicState): number {
  return Math.max(seed.plannedHours - state.completedHours, 0);
}

/** Human-readable "next action" derived from priority + state. */
export function nextAction(
  priority: number,
  state: TopicState,
  seed: TopicSeed,
): string {
  if (state.include === "No") return "Skip for now";
  if (state.status === "skipped") return "Skip for now";
  if (state.include === "Later") return "Defer for later";
  const done =
    state.status === "done" ||
    (seed.plannedHours > 0 && state.completedHours / seed.plannedHours >= 1);
  if (done) return "Keep warm (light review)";
  if (priority >= ACTION_THRESHOLDS.studyNext) return "Study next";
  if (priority >= ACTION_THRESHOLDS.studyThisWeek) return "Study this week";
  if (priority >= ACTION_THRESHOLDS.practice) return "Practice problems";
  return "Quick review";
}

/**
 * Stable comparator for ranking topics by priority (desc), breaking ties with
 * the original workbook row order so the ranking is deterministic.
 */
export function comparePriority(
  a: { priority: number; seed: TopicSeed },
  b: { priority: number; seed: TopicSeed },
): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.seed.rowOrder - b.seed.rowOrder;
}
