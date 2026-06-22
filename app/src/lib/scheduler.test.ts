import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { TOPICS } from "../data/topics";
import { computeTopics } from "./plannerLogic";
import { buildWeeklyPlan, collectMissedTopicIds, suggestMinutes } from "./scheduler";

const TODAY = "2026-06-21"; // Sunday
const MON = "2026-06-22"; // Monday (Normal day, 35 min available)

describe("scheduler", () => {
  it("never assigns study on Rest days", () => {
    const state = buildInitialState();
    state.dailyAvailability[4] = { ...state.dailyAvailability[4], mode: "Rest" }; // Thursday
    const plan = buildWeeklyPlan({ state, computed: computeTopics(state), today: TODAY });
    const rest = plan.filter((d) => d.mode === "Rest");
    expect(rest.length).toBeGreaterThan(0);
    for (const d of rest) {
      expect(d.topicId).toBeNull();
      expect(d.suggestedMinutes).toBe(0);
      expect(d.status).toBe("rest");
    }
  });

  it("never suggests more minutes than are available", () => {
    const state = buildInitialState();
    const plan = buildWeeklyPlan({ state, computed: computeTopics(state), today: TODAY });
    for (const d of plan) {
      expect(d.suggestedMinutes).toBeLessThanOrEqual(d.availableMinutes);
    }
  });

  it("clamps a session to the mode cap and availability", () => {
    expect(suggestMinutes("Normal", 200)).toBe(45);
    expect(suggestMinutes("Normal", 30)).toBe(30);
    expect(suggestMinutes("Low Energy", 200)).toBe(20);
    expect(suggestMinutes("Rest", 200)).toBe(0);
    expect(suggestMinutes("Family", 0)).toBe(0);
  });

  it("produces exactly 7 days with one marked today", () => {
    const state = buildInitialState();
    const plan = buildWeeklyPlan({ state, computed: computeTopics(state), today: TODAY });
    expect(plan).toHaveLength(7);
    expect(plan.filter((d) => d.isToday)).toHaveLength(1);
  });
});

describe("scheduler day modes", () => {
  const planFor = (state: ReturnType<typeof buildInitialState>, today = TODAY) =>
    buildWeeklyPlan({ state, computed: computeTopics(state), today });

  it("work and not-in-mood reduce the suggested load", () => {
    const base = buildInitialState();
    const normalMon = planFor(base).find((d) => d.date === MON)!;

    const work = buildInitialState();
    work.dayOverrides[MON] = { mode: "work", updatedAt: "t" };
    const workMon = planFor(work).find((d) => d.date === MON)!;
    expect(workMon.dayMode).toBe("work");
    expect(workMon.suggestedMinutes).toBeLessThan(normalMon.suggestedMinutes);

    const mood = buildInitialState();
    mood.dayOverrides[MON] = { mode: "not-in-mood", updatedAt: "t" };
    const moodMon = planFor(mood).find((d) => d.date === MON)!;
    expect(moodMon.suggestedMinutes).toBeLessThanOrEqual(20);
    expect(moodMon.suggestedMinutes).toBeLessThan(normalMon.suggestedMinutes);
  });

  it("today reflects the day mode (lighter task + shorter time)", () => {
    const state = buildInitialState();
    state.dayOverrides[TODAY] = { mode: "not-in-mood", updatedAt: "t" };
    const today = planFor(state).find((d) => d.isToday)!;
    expect(today.dayMode).toBe("not-in-mood");
    expect(today.task).toContain("Low-energy");
    expect(today.suggestedMinutes).toBeLessThanOrEqual(20);
  });

  it("family/travel past days are soft-skipped, not harsh missed", () => {
    const WED = "2026-06-24";
    const state = buildInitialState();
    state.dayOverrides[MON] = { mode: "family", updatedAt: "t" }; // past relative to WED
    state.dayOverrides["2026-06-23"] = { mode: "travel", updatedAt: "t" }; // Tuesday, past
    const plan = planFor(state, WED);

    const mon = plan.find((d) => d.date === MON)!;
    const tue = plan.find((d) => d.date === "2026-06-23")!;
    expect(mon.status).toBe("skipped");
    expect(tue.status).toBe("skipped");
    const missed = collectMissedTopicIds(plan);
    expect(missed).not.toContain(mon.topicId);
    expect(missed).not.toContain(tue.topicId);
  });

  it("a normal past day with no log is still a (hard) missed day", () => {
    const WED = "2026-06-24";
    const plan = planFor(buildInitialState(), WED);
    const tue = plan.find((d) => d.date === "2026-06-23")!; // Normal, past, no override
    expect(tue.status).toBe("missed");
  });

  it("respects a locked/pinned topic regardless of priority", () => {
    const pinned = TOPICS[TOPICS.length - 1].id; // a low-priority topic
    const state = buildInitialState();
    state.dayOverrides[MON] = { topicId: pinned, locked: true, updatedAt: "t" };
    const mon = planFor(state).find((d) => d.date === MON)!;
    expect(mon.topicId).toBe(pinned);
  });

  it("applies a manual planned-minutes override, clamped to availability", () => {
    const state = buildInitialState();
    state.dayOverrides[MON] = { plannedMinutes: 15, updatedAt: "t" };
    const mon = planFor(state).find((d) => d.date === MON)!;
    expect(mon.suggestedMinutes).toBe(15);

    state.dayOverrides[MON] = { plannedMinutes: 999, updatedAt: "t" };
    const capped = planFor(state).find((d) => d.date === MON)!;
    expect(capped.suggestedMinutes).toBe(capped.availableMinutes);
  });

  it("regenerating the week preserves manually set day modes", () => {
    const state = buildInitialState();
    state.dayOverrides[MON] = { mode: "travel", updatedAt: "t" };
    const p1 = planFor(state).find((d) => d.date === MON)!;
    const p2 = planFor(state).find((d) => d.date === MON)!; // "regenerate"
    expect(p1.dayMode).toBe("travel");
    expect(p2.dayMode).toBe("travel");
    expect(state.dayOverrides[MON].mode).toBe("travel"); // scheduler never mutates it
  });
});
