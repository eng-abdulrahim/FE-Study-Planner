import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { computeTopics } from "./plannerLogic";
import type { ComputedTopic, DailyStudyPlan, PlannerState, StudyTaskType } from "../types/planner";
import { buildStudyPlan, computeCoverage, distributeMinutes } from "./dailyPlan";

const TASK_TYPES: StudyTaskType[] = [
  "learn",
  "review",
  "practice",
  "formula-review",
  "mixed-practice",
  "light-review",
];

/** State with every weekday a generous Normal day (so plans are rich + cover). */
function richState(examDate = "2026-08-30"): PlannerState {
  const state = buildInitialState();
  state.examDate = examDate;
  state.dailyAvailability = state.dailyAvailability.map((d) => ({
    ...d,
    mode: "Normal",
    minutes: 180,
  }));
  return state;
}

function plan(state: PlannerState, today: string) {
  return buildStudyPlan({ state, computed: computeTopics(state), today });
}

function allTasks(days: DailyStudyPlan[]) {
  return days.flatMap((d) => d.tasks);
}

function countTopic(days: DailyStudyPlan[], topicId: string): number {
  return allTasks(days).filter((t) => t.topicId === topicId).length;
}

describe("distributeMinutes", () => {
  it("sums exactly to the budget for a feasible day", () => {
    const specs = [{ type: "learn" }, { type: "review" }, { type: "practice" }] as const;
    const mins = distributeMinutes([...specs], 90);
    expect(mins.reduce((a, b) => a + b, 0)).toBe(90);
    expect(mins.every((m) => m > 0)).toBe(true);
  });

  it("returns zeros for an empty shape or zero budget", () => {
    expect(distributeMinutes([], 60)).toEqual([]);
    expect(distributeMinutes([{ type: "learn" }], 0)).toEqual([0]);
  });
});

describe("buildStudyPlan - multi-task days", () => {
  it("builds several blocks on a full Normal day and minutes sum to the total", () => {
    const { days } = plan(richState(), "2026-06-01");
    const today = days[0];
    expect(today.tasks.length).toBeGreaterThanOrEqual(3);
    const sum = today.tasks.reduce((s, t) => s + t.plannedMinutes, 0);
    expect(sum).toBe(today.totalPlannedMinutes);
    expect(today.totalPlannedMinutes).toBeGreaterThan(0);
    expect(today.totalPlannedMinutes).toBeLessThanOrEqual(180);
    for (const t of today.tasks) expect(TASK_TYPES).toContain(t.type);
  });

  it("is deterministic (same inputs -> identical plan)", () => {
    const s = richState();
    const a = plan(s, "2026-06-01").days[0];
    const b = plan(s, "2026-06-01").days[0];
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("buildStudyPlan - coverage", () => {
  it("includes every eligible topic at least once across the horizon", () => {
    const state = richState();
    const computed = computeTopics(state);
    const eligible = computed.filter(
      (t: ComputedTopic) =>
        t.state.include !== "No" &&
        t.state.status !== "done" &&
        t.state.status !== "skipped" &&
        t.priority > 0,
    );
    const { days } = buildStudyPlan({ state, computed, today: "2026-06-01" });
    const seen = new Set(allTasks(days).map((t) => t.topicId).filter(Boolean) as string[]);
    for (const t of eligible) {
      expect(seen.has(t.seed.id)).toBe(true);
    }
  });

  it("schedules high-priority/weak topics more often than a low-priority one", () => {
    const state = richState();
    const computed = computeTopics(state);
    const eligible = computed
      .filter((t) => t.priority > 0 && t.state.status !== "done")
      .sort((a, b) => b.priority - a.priority);
    const high = eligible[0];
    const low = eligible[eligible.length - 1];
    const { days } = buildStudyPlan({ state, computed, today: "2026-06-01" });
    expect(countTopic(days, high.seed.id)).toBeGreaterThan(countTopic(days, low.seed.id));
  });

  it("never schedules a Done topic as a new learning block", () => {
    const state = richState();
    const doneId = computeTopics(state).find((t) => t.priority > 0)!.seed.id;
    state.topics[doneId] = { ...state.topics[doneId], status: "done" };
    const { days } = plan(state, "2026-06-01");
    const learnHits = allTasks(days).filter((t) => t.type === "learn" && t.topicId === doneId);
    expect(learnHits).toHaveLength(0);
  });

  it("reports coverage counts from saved state", () => {
    const state = richState();
    const id = computeTopics(state).find((t) => t.priority > 0)!.seed.id;
    state.topics[id] = { ...state.topics[id], status: "studying", completedHours: 1 };
    const cov = computeCoverage(computeTopics(state));
    expect(cov.totalTopics).toBeGreaterThan(0);
    expect(cov.coveredTopics).toBeGreaterThanOrEqual(1);
    expect(cov.coveredTopics + cov.remainingTopics).toBe(cov.totalTopics);
  });
});

describe("buildStudyPlan - day modes", () => {
  const MON = "2026-06-22"; // Monday, Normal 35 min by default

  function todayWith(mode: PlannerState["dayOverrides"][string]["mode"]) {
    const state = buildInitialState(); // default availability (Mon = Normal 35)
    state.dayOverrides[MON] = { mode, updatedAt: "t" };
    return plan(state, MON).days[0];
  }

  it("not-in-mood: light, review-leaning, no heavy practice/learn", () => {
    const day = todayWith("not-in-mood");
    expect(day.totalPlannedMinutes).toBeLessThanOrEqual(20);
    for (const t of day.tasks) expect(["review", "formula-review", "light-review"]).toContain(t.type);
  });

  it("family: optional/light review only", () => {
    const day = todayWith("family");
    expect(day.totalPlannedMinutes).toBeLessThanOrEqual(15);
    for (const t of day.tasks) expect(["light-review", "review"]).toContain(t.type);
  });

  it("travel: mobile-friendly (formulas/notes), no calculation-heavy blocks", () => {
    const day = todayWith("travel");
    expect(day.totalPlannedMinutes).toBeLessThanOrEqual(20);
    for (const t of day.tasks) {
      expect(["formula-review", "light-review"]).toContain(t.type);
      expect(t.type).not.toBe("learn");
      expect(t.type).not.toBe("practice");
    }
  });

  it("work: short, focused, at most two blocks with the most important topic", () => {
    const day = todayWith("work");
    expect(day.totalPlannedMinutes).toBeLessThanOrEqual(30);
    expect(day.tasks.length).toBeLessThanOrEqual(2);
    expect(day.tasks.some((t) => t.type === "learn")).toBe(true);
  });

  it("keeps a done block visible in place and reschedules a skipped block later", () => {
    const state = richState();
    const computed = computeTopics(state);
    const day0 = buildStudyPlan({ state, computed, today: "2026-06-01" }).days[0];
    const learn = day0.tasks.find((t) => t.type === "learn" && t.topicId);
    expect(learn).toBeTruthy();

    // Skip that learn block.
    state.taskStatus = { [learn!.id]: "skipped" };
    const { days } = buildStudyPlan({ state, computed: computeTopics(state), today: "2026-06-01" });
    // Still shown (as skipped) on day 0.
    const sameSlot = days[0].tasks.find((t) => t.id === learn!.id);
    expect(sameSlot?.status).toBe("skipped");
    // And the topic resurfaces as a planned learn block on a later day.
    const laterLearn = days
      .slice(1)
      .some((d) => d.tasks.some((t) => t.type === "learn" && t.topicId === learn!.topicId));
    expect(laterLearn).toBe(true);
  });

  it("a skipped day produces no tasks", () => {
    const state = buildInitialState();
    state.dayOverrides[MON] = { status: "skipped", updatedAt: "t" };
    const day = plan(state, MON).days[0];
    expect(day.isSkipped).toBe(true);
    expect(day.tasks).toHaveLength(0);
  });
});

describe("buildStudyPlan - final review phase", () => {
  it("switches to mixed practice + formula review in the last week", () => {
    const state = buildInitialState();
    state.examDate = "2026-07-22";
    const today = "2026-07-20"; // 2 days before exam -> final review
    const day = plan(state, today).days[0];
    expect(day.phase).toBe("final-review");
    const types = day.tasks.map((t) => t.type);
    expect(types).toContain("mixed-practice");
    expect(types).toContain("formula-review");
  });
});

describe("buildStudyPlan - plan tuning", () => {
  it("light day shrinks today's plan", () => {
    const normal = plan(richState(), "2026-06-01").days[0];
    const light = richState();
    light.planTuning = { ...light.planTuning, lightDay: true };
    const lightDay = plan(light, "2026-06-01").days[0];
    expect(lightDay.totalPlannedMinutes).toBeLessThan(normal.totalPlannedMinutes);
    expect(lightDay.totalPlannedMinutes).toBeLessThanOrEqual(20);
  });

  it("more practice adds an extra practice/mixed block", () => {
    const base = plan(richState(), "2026-06-01").days[0];
    const tuned = richState();
    tuned.planTuning = { ...tuned.planTuning, morePractice: true };
    const tunedDay = plan(tuned, "2026-06-01").days[0];
    const practiceCount = (d: DailyStudyPlan) =>
      d.tasks.filter((t) => t.type === "practice" || t.type === "mixed-practice").length;
    expect(practiceCount(tunedDay)).toBeGreaterThanOrEqual(practiceCount(base));
  });
});

describe("buildStudyPlan - regenerate seed", () => {
  it("the default seed 0 keeps the exact same plan (regenerate is opt-in)", () => {
    const base = plan(richState(), "2026-06-01").days;
    const seeded = plan({ ...richState(), planSeed: 0 }, "2026-06-01").days;
    expect(JSON.stringify(seeded)).toBe(JSON.stringify(base));
  });

  it("a new seed reshuffles the auto-picked review/practice topics", () => {
    const a = plan(richState(), "2026-06-01").days;
    const b = plan({ ...richState(), planSeed: 3 }, "2026-06-01").days;
    // Same deterministic engine, different seed -> a visibly different plan.
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
    // ...but stable for that seed (still pure/deterministic).
    const b2 = plan({ ...richState(), planSeed: 3 }, "2026-06-01").days;
    expect(JSON.stringify(b2)).toBe(JSON.stringify(b));
  });

  it("still covers every eligible topic after a reshuffle", () => {
    const state = { ...richState(), planSeed: 7 };
    const computed = computeTopics(state);
    const eligible = computed.filter(
      (t) =>
        t.state.include !== "No" &&
        t.state.status !== "done" &&
        t.state.status !== "skipped" &&
        t.priority > 0,
    );
    const { days } = buildStudyPlan({ state, computed, today: "2026-06-01" });
    const seen = new Set(allTasks(days).map((t) => t.topicId).filter(Boolean) as string[]);
    for (const t of eligible) expect(seen.has(t.seed.id)).toBe(true);
  });

  it("never schedules a Done topic as a learn block under a non-zero seed", () => {
    const state = { ...richState(), planSeed: 4 };
    const doneId = computeTopics(state).find((t) => t.priority > 0)!.seed.id;
    state.topics = { ...state.topics, [doneId]: { ...state.topics[doneId], status: "done" } };
    const { days } = plan(state, "2026-06-01");
    const learnHits = allTasks(days).filter((t) => t.type === "learn" && t.topicId === doneId);
    expect(learnHits).toHaveLength(0);
  });
});

describe("buildStudyPlan - supportive language", () => {
  it("never uses discouraging wording in focus messages", () => {
    const { days } = plan(richState(), "2026-06-01");
    const banned = ["behind", "late", "failing", "too slow", "impossible", "not enough"];
    for (const d of days) {
      const msg = d.focusMessage.toLowerCase();
      for (const w of banned) expect(msg).not.toContain(w);
    }
  });
});
