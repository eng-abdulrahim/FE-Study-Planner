// Readiness score - answers "how READY am I for the exam?".
//
// This is intentionally INDEPENDENT from Priority. The Excel workbook reused
// the priority weighting for readiness, which made overall readiness DROP when
// a top topic was completed (its priority weight collapsed). Here readiness
// uses a STATIC weight per topic and a MONOTONIC progress value, so finishing
// work, raising confidence, or logging hours can never reduce readiness.
import type { TopicSeed, TopicState } from "../types/planner";
import { STATUS_PROGRESS } from "../data/defaults";
import { clamp } from "./util";

export function statusProgress(state: TopicState): number {
  return STATUS_PROGRESS[state.status] ?? 0;
}

/** Static weight that never changes with user edits (keeps readiness monotonic). */
export function staticWeight(seed: TopicSeed): number {
  // Exam weight already encodes importance; planned hours nudges larger topics up.
  return seed.examWeight + seed.plannedHours * 0.5;
}

/**
 * TopicProgress = max( StatusProgress, 0.6*HoursRatio + 0.4*ConfidenceRatio ).
 * Each input is non-decreasing, so the result is monotonic in status,
 * completed hours and confidence.
 */
export function topicProgress(seed: TopicSeed, state: TopicState): number {
  const hoursRatio =
    seed.plannedHours > 0 ? clamp(state.completedHours / seed.plannedHours, 0, 1) : 0;
  const confidenceRatio = clamp((state.confidence - 1) / 4, 0, 1);
  const combined = 0.6 * hoursRatio + 0.4 * confidenceRatio;
  return clamp(Math.max(statusProgress(state), combined), 0, 1);
}

export function readinessContribution(seed: TopicSeed, state: TopicState): number {
  return staticWeight(seed) * topicProgress(seed, state);
}

/**
 * OverallReadiness = SUM(StaticWeight * TopicProgress) / SUM(StaticWeight)
 * over included topics (Include != "No"). Returns a 0..1 fraction.
 */
export function overallReadiness(
  entries: { seed: TopicSeed; state: TopicState }[],
): number {
  let num = 0;
  let den = 0;
  for (const { seed, state } of entries) {
    if (state.include === "No") continue;
    const w = staticWeight(seed);
    den += w;
    num += w * topicProgress(seed, state);
  }
  return den > 0 ? num / den : 0;
}
