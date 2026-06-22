// Adaptive daily target - the "honest but gentle" brain.
//
// PHILOSOPHY (see the project brief):
// - Start gentle so the user begins without fear (Soft Start).
// - Grow the target only from REAL completed work (Ramp Up), never wishful jumps.
// - When days slip, recover calmly (Catch Up) by redistributing missed time.
// - When the exam is close and the load is high, stop pretending (Emergency) -
//   but still keep the wording calm and keep a tiny minimum alive.
//
// The engine stays mathematically honest: it always knows the true required pace
// (remainingHours / daysRemaining). The UI shows THREE targets so we never hide
// the real risk and never overwhelm with a single scary number:
//   - minimum    : keeps the plan alive (small, always doable)
//   - recommended: today's real goal (gentle, ramps with momentum)
//   - recovery   : protects the exam date (the honest pace, humanely capped)
//
// This module is pure (numbers in, plan out) so every scenario is unit-testable.
import { clamp, round1 } from "./util";

export type AdaptiveMode = "soft-start" | "ramp-up" | "catch-up" | "emergency" | "done";
export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface AdaptiveInput {
  examPassed: boolean;
  daysRemaining: number; // whole days, >= 0
  remainingHours: number;
  completedHours: number;
  plannedTotalHours: number;
  /** Today's configured availability (minutes). The gentle floor for soft start. */
  todayAvailabilityMinutes: number;

  // Behaviour signals (drive momentum + catch-up).
  completedStudyDays: number; // distinct logged study dates (all time)
  recentActiveDays: number; // distinct logged dates within the last 7 days
  daysSinceLastStudy: number | null; // null when nothing logged yet
  recentSkips: number; // skipped day-overrides within the last 7 days

  // Coverage signals (drive emergency triage).
  untouchedTier1: number;
  totalTier1: number;
  weakRemaining: number;
  remainingTopics: number;
  totalTopics: number;
}

export interface AdaptivePlan {
  mode: AdaptiveMode;
  riskLevel: RiskLevel;
  /** 0..1 - how far behind the safe pace + behaviour signals put the user. */
  catchUpPressure: number;
  /** 0..1 - recent study consistency. */
  momentum: number;
  /** The honest required pace (raw, may exceed the recovery cap). */
  requiredDailyHours: number;
  requiredWeeklyHours: number;
  // Targets in minutes (rounded to 5).
  minimumMinutes: number;
  recommendedMinutes: number;
  recoveryMinutes: number;
  // Calm, guilt-free copy.
  headline: string;
  message: string;
  /** Honest pace line, shown only when risk is at least moderate (else null). */
  honestLine: string | null;
  /** Emergency triage tips (empty unless emergency). */
  focusStrategy: string[];
}

// ---- Tunable constants -----------------------------------------------------

const MIN_TARGET_MIN = 30; // "keeps the plan alive"
const SOFT_CAP_MIN = 45; // day-1 / no-momentum gentle ceiling
/** Gentle ramp ladder (minutes) indexed by how many days the user has studied. */
const RAMP_LADDER = [30, 45, 60, 90, 120];
/** How hard pressure pushes the recommended target toward the NEXT ramp rung.
 *  0 = pure gentle ladder (soft start); 1 = reach the next rung when maxed out.
 *  Bounded by design so the target never jumps more than one rung at a time. */
const MODE_PUSH: Record<AdaptiveMode, number> = {
  "soft-start": 0,
  "ramp-up": 0.5,
  "catch-up": 1,
  emergency: 1,
  done: 0,
};
const RECOVERY_CAP_MIN = 240; // 4h - recovery target is honest but humane (never scarier)
const SAFE_DAILY_HOURS = 4; // required/day above this => emergency territory
const STALL_DAYS = 3; // no study for this many days => momentum decays

function roundTo5(min: number): number {
  return Math.max(0, Math.round(min / 5) * 5);
}

function riskFor(requiredDailyHours: number): RiskLevel {
  if (requiredDailyHours >= SAFE_DAILY_HOURS) return "critical";
  if (requiredDailyHours >= 2) return "high";
  if (requiredDailyHours >= 1) return "moderate";
  return "low";
}

/** Where on the ramp ladder the user is, decaying one step after a stall. */
function momentumStepFor(input: AdaptiveInput): number {
  let step = clamp(input.completedStudyDays, 0, RAMP_LADDER.length - 1);
  if (input.daysSinceLastStudy != null && input.daysSinceLastStudy >= STALL_DAYS) {
    step = Math.max(0, step - 1);
  }
  return Math.round(step);
}

function catchUpPressureFor(input: AdaptiveInput, requiredDailyHours: number): number {
  // Pace: 0 at idle, 1 at the safe daily ceiling.
  const pace = clamp(requiredDailyHours / SAFE_DAILY_HOURS, 0, 1);
  // Skips + stalls.
  const skip =
    clamp(input.recentSkips * 0.12, 0, 0.3) +
    (input.daysSinceLastStudy != null && input.daysSinceLastStudy >= STALL_DAYS ? 0.15 : 0);
  // Untouched high-yield (Tier 1) coverage gap.
  const tier1Gap = input.totalTier1 > 0 ? input.untouchedTier1 / input.totalTier1 : 0;
  // Very low progress is extra pressure.
  const progress =
    input.plannedTotalHours > 0 ? input.completedHours / input.plannedTotalHours : 0;
  const lowProgress = progress < 0.1 ? 0.1 : 0;

  return clamp(0.6 * pace + skip + 0.2 * tier1Gap + lowProgress, 0, 1);
}

function modeFor(
  input: AdaptiveInput,
  requiredDailyHours: number,
  pressure: number,
  momentum: number,
): AdaptiveMode {
  if (input.examPassed || input.remainingHours <= 0) return "done";

  const progress =
    input.plannedTotalHours > 0 ? input.completedHours / input.plannedTotalHours : 0;

  const stalled =
    input.daysSinceLastStudy != null &&
    input.daysSinceLastStudy >= STALL_DAYS &&
    input.completedStudyDays > 0;
  const finalStretch = input.daysRemaining <= 14;
  // A gentle early window: the first few sessions stay encouraging so a first
  // win is never met with a panic screen. Skips, stalls and the final stretch
  // all end onboarding so honesty kicks in exactly when behaviour calls for it.
  const onboarding = input.completedStudyDays < 3 && input.recentSkips === 0 && !stalled;

  const emergency =
    requiredDailyHours >= SAFE_DAILY_HOURS ||
    (finalStretch && requiredDailyHours >= 2.5) ||
    (input.daysRemaining <= 21 && progress < 0.1 && requiredDailyHours >= 3);
  // During onboarding (and only when not in the final stretch) we do NOT jump to
  // emergency from pace alone - the recovery target + honest line still show the
  // real pressure while we build the habit.
  if (emergency && !(onboarding && !finalStretch)) return "emergency";

  if (!onboarding || finalStretch) {
    if (pressure >= 0.55 || input.recentSkips >= 2 || stalled) return "catch-up";
  }

  if (input.completedStudyDays === 0 || momentum < 0.2) return "soft-start";
  return "ramp-up";
}

const HEADLINE: Record<AdaptiveMode, string> = {
  "soft-start": "Soft start",
  "ramp-up": "Building momentum",
  "catch-up": "Gentle catch-up",
  emergency: "Protect the exam date",
  done: "All caught up",
};

const MESSAGE: Record<AdaptiveMode, string> = {
  "soft-start": "Begin with one small, calm session today. Small progress still counts.",
  "ramp-up": "You are building a steady habit. Today's goal steps up a little - keep it going.",
  "catch-up":
    "A few days slipped, and that is okay. Today's goal helps you recover without rushing.",
  emergency:
    "The exam is close and there is a lot left. Focus on high-yield topics and practice. Even a small session keeps the plan alive.",
  done: "You have covered the planned hours. Keep warm with light review and practice.",
};

/** Compute the adaptive plan for today. Pure: same input -> same output. */
export function computeAdaptivePlan(input: AdaptiveInput): AdaptivePlan {
  const safeDays = Math.max(input.daysRemaining, 1);
  const requiredDailyHours =
    input.examPassed || input.remainingHours <= 0 ? 0 : input.remainingHours / safeDays;
  const requiredWeeklyHours = requiredDailyHours * 7;
  const requiredMinutes = requiredDailyHours * 60;

  const momentum = clamp(input.recentActiveDays / 5, 0, 1);
  const pressure = catchUpPressureFor(input, requiredDailyHours);
  const mode = modeFor(input, requiredDailyHours, pressure, momentum);

  const step = momentumStepFor(input);
  const base = RAMP_LADDER[step];
  const nextRung = RAMP_LADDER[Math.min(step + 1, RAMP_LADDER.length - 1)];
  const recoveryRaw = clamp(requiredMinutes, MIN_TARGET_MIN, RECOVERY_CAP_MIN);

  // Recommended grows along the gentle ramp ladder; pressure (scaled by REAL
  // recent momentum) nudges it toward the NEXT rung but never past it, so the
  // target can never jump suddenly. Soft start ignores the nudge entirely.
  const gentleCeiling = Math.max(input.todayAvailabilityMinutes, SOFT_CAP_MIN);
  let recommended =
    mode === "done"
      ? MIN_TARGET_MIN
      : base + (nextRung - base) * clamp(pressure * momentum, 0, 1) * MODE_PUSH[mode];
  // Never recommend more than the honest pace actually needs - this keeps the
  // target gentle when the user is comfortably ahead (low required pace).
  recommended = Math.min(recommended, Math.max(recoveryRaw, MIN_TARGET_MIN));
  // Falling behind keeps a meaningful floor (never drops back to the bare 30m).
  if (mode === "catch-up" || mode === "emergency") recommended = Math.max(recommended, 45);
  // Day-1 / no-momentum guarantee: stay gentle before any habit is built, even
  // under high pressure. The recovery target still tells the honest truth.
  if (step === 0) recommended = Math.min(recommended, gentleCeiling);
  recommended = roundTo5(recommended);

  const minimumMinutes = roundTo5(clamp(Math.min(MIN_TARGET_MIN, recommended), 10, recommended));
  const recoveryMinutes =
    mode === "done" ? recommended : roundTo5(Math.max(recoveryRaw, recommended));

  const riskLevel = input.examPassed ? "low" : riskFor(requiredDailyHours);

  const honestLine =
    mode === "done" || riskLevel === "low"
      ? null
      : `To fully protect your exam date, the pace is about ${round1(requiredDailyHours)}h a day. Build toward it gradually - you do not have to hit it today.`;

  const focusStrategy =
    mode === "emergency"
      ? [
          "Lead with Tier 1 high-yield topics.",
          "Practice FE-style problems over re-reading.",
          "Keep formulas and the handbook close.",
          "Triage weak areas - cover the essentials first.",
        ]
      : [];

  return {
    mode,
    riskLevel,
    catchUpPressure: round1(pressure * 10) / 10,
    momentum: round1(momentum * 10) / 10,
    requiredDailyHours: round1(requiredDailyHours),
    requiredWeeklyHours: round1(requiredWeeklyHours),
    minimumMinutes,
    recommendedMinutes: recommended,
    recoveryMinutes,
    headline: HEADLINE[mode],
    message: MESSAGE[mode],
    honestLine,
    focusStrategy,
  };
}
