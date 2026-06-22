import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { TOPICS } from "../data/topics";
import type { DayPlan } from "../types/planner";
import { markDayDoneIn, undoDayDoneIn } from "./studyActions";

const TOPIC = TOPICS[0].id;

function makeDay(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    date: "2026-06-22",
    dayName: "Monday",
    weekdayIndex: 1,
    mode: "Normal",
    availableMinutes: 60,
    energy: 3,
    topicId: TOPIC,
    topicName: "Algebra",
    section: "Mathematics",
    tier: 1,
    priority: 10,
    suggestedMinutes: 60,
    task: "Study",
    status: "planned",
    dayMode: "normal",
    noteUrl: "",
    isToday: false,
    fromBacklog: false,
    ...overrides,
  };
}

describe("status pill transitions (study log)", () => {
  it("Planned -> Done logs a session and adds the hours once", () => {
    const state = buildInitialState();
    const day = makeDay({ suggestedMinutes: 60 });
    let n = 0;
    const makeId = () => `id-${n++}`;

    const done = markDayDoneIn(state, day, makeId);
    expect(done.studyLog).toHaveLength(1);
    expect(done.studyLog[0].minutes).toBe(60);
    expect(done.topics[TOPIC].completedHours).toBeCloseTo(1);

    // Idempotent: marking the same day/topic again is a no-op (no duplicate log).
    const again = markDayDoneIn(done, day, makeId);
    expect(again).toBe(done);
    expect(again.studyLog).toHaveLength(1);
  });

  it("Done -> Planned removes the log and gives the hours back", () => {
    const state = buildInitialState();
    const day = makeDay({ suggestedMinutes: 90 });
    const done = markDayDoneIn(state, day, () => "x");
    expect(done.topics[TOPIC].completedHours).toBeCloseTo(1.5);

    const undone = undoDayDoneIn(done, day);
    expect(undone.studyLog).toHaveLength(0);
    expect(undone.topics[TOPIC].completedHours).toBeCloseTo(0);
  });

  it("undo with nothing logged is a safe no-op", () => {
    const state = buildInitialState();
    expect(undoDayDoneIn(state, makeDay())).toBe(state);
  });

  it("never marks a Rest day done", () => {
    const state = buildInitialState();
    expect(markDayDoneIn(state, makeDay({ mode: "Rest" }), () => "x")).toBe(state);
  });

  it("completed hours never go negative on over-undo", () => {
    const state = buildInitialState();
    const day = makeDay({ suggestedMinutes: 30 });
    const done = markDayDoneIn(state, day, () => "x");
    const undone = undoDayDoneIn(done, day);
    const undoneAgain = undoDayDoneIn(undone, day); // nothing left
    expect(undoneAgain.topics[TOPIC].completedHours).toBeGreaterThanOrEqual(0);
  });
});
