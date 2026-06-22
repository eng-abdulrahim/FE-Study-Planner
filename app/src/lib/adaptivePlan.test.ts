// Adaptive plan tests - cover the philosophy (gentle but honest) and the six
// review scenarios (A-F). The brain is pure, so each scenario is just an input.
import { describe, it, expect } from "vitest";
import { computeAdaptivePlan } from "./adaptivePlan";
import type { AdaptiveInput, AdaptivePlan } from "./adaptivePlan";
import { buildModel } from "./plannerLogic";
import { buildInitialState } from "../data/defaults";
import type { PlannerState, StudyLogEntry } from "../types/planner";

// The real project baseline: 150.5h over ~29 days (a genuinely cramped plan).
function base(overrides: Partial<AdaptiveInput> = {}): AdaptiveInput {
  return {
    examPassed: false,
    daysRemaining: 29,
    remainingHours: 150.5,
    completedHours: 0,
    plannedTotalHours: 150.5,
    todayAvailabilityMinutes: 35,
    completedStudyDays: 0,
    recentActiveDays: 0,
    daysSinceLastStudy: null,
    recentSkips: 0,
    untouchedTier1: 12,
    totalTier1: 12,
    weakRemaining: 20,
    remainingTopics: 85,
    totalTopics: 85,
    ...overrides,
  };
}

const GUILT_WORDS = ["behind", "fail", "too late", "lazy", "shame", "bad progress"];

function assertCalm(plan: AdaptivePlan): void {
  const text = `${plan.headline} ${plan.message} ${plan.honestLine ?? ""}`.toLowerCase();
  for (const w of GUILT_WORDS) expect(text).not.toContain(w);
}

function assertInvariants(plan: AdaptivePlan): void {
  expect(plan.minimumMinutes).toBeLessThanOrEqual(plan.recommendedMinutes);
  expect(plan.recommendedMinutes).toBeLessThanOrEqual(plan.recoveryMinutes);
  expect(plan.minimumMinutes).toBeGreaterThanOrEqual(10);
  for (const v of [plan.minimumMinutes, plan.recommendedMinutes, plan.recoveryMinutes]) {
    expect(v % 5).toBe(0); // rounded to 5 minutes
    expect(Number.isFinite(v)).toBe(true);
  }
  expect(plan.catchUpPressure).toBeGreaterThanOrEqual(0);
  expect(plan.catchUpPressure).toBeLessThanOrEqual(1);
}

describe("adaptivePlan - invariants + calm wording", () => {
  it("holds invariants and stays calm across many states", () => {
    const states: AdaptiveInput[] = [
      base(),
      base({ completedStudyDays: 1, recentActiveDays: 1, daysSinceLastStudy: 0, completedHours: 0.5, remainingHours: 150 }),
      base({ completedStudyDays: 5, recentActiveDays: 5, daysSinceLastStudy: 0, completedHours: 8, remainingHours: 142 }),
      base({ recentSkips: 3, daysSinceLastStudy: 4, completedStudyDays: 3, completedHours: 4, remainingHours: 146 }),
      base({ daysRemaining: 200, remainingHours: 150.5 }), // far exam
      base({ daysRemaining: 7, remainingHours: 20 }), // final stretch
      base({ examPassed: true, daysRemaining: 0, remainingHours: 12 }),
      base({ remainingHours: 0, completedHours: 150.5 }),
    ];
    for (const s of states) {
      const plan = computeAdaptivePlan(s);
      assertInvariants(plan);
      assertCalm(plan);
    }
  });
});

describe("Scenario A - first day, no progress", () => {
  const plan = computeAdaptivePlan(base());

  it("starts gentle and never panics on first contact", () => {
    expect(plan.mode).toBe("soft-start");
    expect(plan.recommendedMinutes).toBeLessThanOrEqual(45); // gentle
    expect(plan.minimumMinutes).toBe(30);
    expect(plan.focusStrategy).toHaveLength(0); // no survival screen yet
  });

  it("still knows the true pressure (does not hide the risk)", () => {
    expect(plan.requiredDailyHours).toBeGreaterThan(5); // ~5.2h/day
    expect(plan.riskLevel).toBe("critical");
    expect(plan.recoveryMinutes).toBe(240); // honest recovery target (4h, humanely capped)
    expect(plan.honestLine).not.toBeNull();
  });
});

describe("Scenario B - user completes today's session", () => {
  const before = computeAdaptivePlan(base());
  const after = computeAdaptivePlan(
    base({ completedStudyDays: 1, recentActiveDays: 1, daysSinceLastStudy: 0, completedHours: 0.5, remainingHours: 150 }),
  );

  it("ramps up slightly, never jumping suddenly", () => {
    expect(after.mode).toBe("ramp-up");
    expect(after.recommendedMinutes).toBeGreaterThan(before.recommendedMinutes);
    expect(after.recommendedMinutes).toBeLessThanOrEqual(60); // gentle step, not a leap
  });

  it("keeps the honest recovery target visible", () => {
    expect(after.recoveryMinutes).toBe(240);
    expect(after.honestLine).not.toBeNull();
  });
});

describe("Scenario C - user skips (work) a couple of days", () => {
  const calm = computeAdaptivePlan(
    base({ daysRemaining: 40, remainingHours: 60, completedStudyDays: 4, recentActiveDays: 2, daysSinceLastStudy: 1, completedHours: 12 }),
  );
  const skipped = computeAdaptivePlan(
    base({ daysRemaining: 40, remainingHours: 60, completedStudyDays: 4, recentActiveDays: 2, daysSinceLastStudy: 1, completedHours: 12, recentSkips: 2 }),
  );

  it("enters catch-up and raises pressure (missed time redistributes)", () => {
    expect(skipped.mode).toBe("catch-up");
    expect(skipped.catchUpPressure).toBeGreaterThan(calm.catchUpPressure);
    expect(skipped.recommendedMinutes).toBeGreaterThanOrEqual(calm.recommendedMinutes);
  });

  it("does not shame the user", () => assertCalm(skipped));
});

describe("Scenario D - user skips several days", () => {
  const plan = computeAdaptivePlan(
    base({ completedStudyDays: 3, recentActiveDays: 0, daysSinceLastStudy: 5, recentSkips: 3, completedHours: 4, remainingHours: 146.5 }),
  );

  it("activates emergency mode with high-yield triage", () => {
    expect(plan.mode).toBe("emergency");
    expect(plan.focusStrategy.length).toBeGreaterThan(0);
  });

  it("stops giving a bare 30m as if everything is fine, but stays humane", () => {
    expect(plan.recommendedMinutes).toBeGreaterThan(30);
    expect(plan.recommendedMinutes).toBeLessThanOrEqual(120); // never scary
    expect(plan.honestLine).not.toBeNull();
  });

  it("keeps the wording calm", () => assertCalm(plan));
});

describe("Scenario E - exam date changes", () => {
  it("recalculates the required pace and recovery when days change", () => {
    const near = computeAdaptivePlan(base({ daysRemaining: 14, remainingHours: 80 }));
    const far = computeAdaptivePlan(base({ daysRemaining: 120, remainingHours: 80 }));
    expect(near.requiredDailyHours).toBeGreaterThan(far.requiredDailyHours);
    expect(near.recoveryMinutes).toBeGreaterThanOrEqual(far.recoveryMinutes);
    expect(near.catchUpPressure).toBeGreaterThan(far.catchUpPressure);
  });
});

describe("Scenario F - user marks multiple topics done", () => {
  it("lowers required pace, recovery target and pressure as remaining drops", () => {
    const start = computeAdaptivePlan(base());
    const progressed = computeAdaptivePlan(base({ completedHours: 50.5, remainingHours: 100 }));
    expect(progressed.requiredDailyHours).toBeLessThan(start.requiredDailyHours);
    expect(progressed.recoveryMinutes).toBeLessThanOrEqual(start.recoveryMinutes);
    expect(progressed.catchUpPressure).toBeLessThanOrEqual(start.catchUpPressure);
  });

  it("reaches the done mode once everything is covered", () => {
    const done = computeAdaptivePlan(base({ completedHours: 150.5, remainingHours: 0 }));
    expect(done.mode).toBe("done");
    expect(done.honestLine).toBeNull();
  });
});

describe("adaptivePlan - never recommend more than needed when ahead", () => {
  it("keeps a far-exam, consistent studier gentle", () => {
    const plan = computeAdaptivePlan(
      base({ daysRemaining: 200, remainingHours: 60, completedStudyDays: 5, recentActiveDays: 5, daysSinceLastStudy: 0, completedHours: 30 }),
    );
    // required ~0.3h/day -> recommended must stay small even with full momentum.
    expect(plan.recommendedMinutes).toBeLessThanOrEqual(60);
    assertInvariants(plan);
  });
});

// ---- Integration: buildModel wires the adaptive plan + the engine ramp -------

const MON = "2026-06-22"; // Monday (default availability has blocks)

function withRecentStudyDays(stateExamDate: string, dates: string[]): PlannerState {
  const studyLog: StudyLogEntry[] = dates.map((date, i) => ({
    id: `seed-${i}`,
    date,
    topicId: null,
    topicName: "Session",
    mode: "Normal",
    minutes: 30,
  }));
  return { ...buildInitialState(), examDate: stateExamDate, studyLog };
}

describe("buildModel - adaptive integration", () => {
  it("a fresh plan is soft, gentle, and does not inflate today's blocks", () => {
    const model = buildModel(buildInitialState(), MON);
    expect(model.adaptive.mode).toBe("soft-start");
    expect(model.adaptive.recommendedMinutes).toBeLessThanOrEqual(45);
    // Today's budget is not raised above the gentle availability on day one.
    expect(model.todayStudyPlan!.totalPlannedMinutes).toBeLessThanOrEqual(45);
  });

  it("ramps today's actual blocks once real momentum exists", () => {
    const state = withRecentStudyDays("2026-07-22", [
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
    ]);
    const model = buildModel(state, MON);
    expect(model.adaptive.recommendedMinutes).toBeGreaterThan(45);
    // The engine actually grows today's blocks toward the recommended target.
    expect(model.todayStudyPlan!.totalPlannedMinutes).toBeGreaterThan(60);
  });

  it("recomputes the required pace when the exam date changes", () => {
    const near = buildModel({ ...buildInitialState(), examDate: "2026-07-22" }, MON);
    const far = buildModel({ ...buildInitialState(), examDate: "2026-12-31" }, MON);
    expect(near.adaptive.requiredDailyHours).toBeGreaterThan(far.adaptive.requiredDailyHours);
    expect(near.adaptive.honestLine).not.toBeNull();
    expect(far.adaptive.honestLine).toBeNull(); // far exam = low risk, no warning
  });
});
