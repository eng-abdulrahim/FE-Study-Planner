import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { computeTopics } from "./plannerLogic";
import { buildWeeklyPlan } from "./scheduler";
import { splitWeekByDone, weekPlannedMinutes } from "./weekView";
import { uid } from "./util";

const TODAY = "2026-06-24"; // Wednesday

function planFor(state: ReturnType<typeof buildInitialState>) {
  return buildWeeklyPlan({ state, computed: computeTopics(state), today: TODAY });
}

describe("weekView.splitWeekByDone", () => {
  it("keeps non-done days active and never overlaps the two lists", () => {
    const plan = planFor(buildInitialState());
    const { active, completed } = splitWeekByDone(plan);
    expect(completed).toHaveLength(0); // nothing logged yet
    expect(active).toHaveLength(plan.length);
    expect(active.every((d) => d.status !== "done")).toBe(true);
  });

  it("moves a logged (Done) day out of the active list and into completed", () => {
    const state = buildInitialState();
    const today = planFor(state).find((d) => d.isToday)!;
    state.studyLog.push({
      id: uid(),
      date: today.date,
      topicId: today.topicId,
      topicName: today.topicName,
      mode: today.mode,
      minutes: today.suggestedMinutes,
    });

    const plan = planFor(state);
    const { active, completed } = splitWeekByDone(plan);
    expect(active.some((d) => d.date === today.date)).toBe(false);
    expect(completed.some((d) => d.date === today.date)).toBe(true);
    expect(active.length + completed.length).toBe(plan.length);
  });

  it("sums planned minutes across the week", () => {
    const plan = planFor(buildInitialState());
    const expected = plan.reduce((s, d) => s + d.suggestedMinutes, 0);
    expect(weekPlannedMinutes(plan)).toBe(expected);
  });
});
