import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { TOPICS } from "../data/topics";
import { overallReadiness } from "./readiness";
import type { PlannerState } from "../types/planner";

function entries(state: PlannerState) {
  return TOPICS.map((seed) => ({ seed, state: state.topics[seed.id] }));
}

describe("readiness (monotonic)", () => {
  it("does not decrease when a topic is marked Done", () => {
    const state = buildInitialState();
    const before = overallReadiness(entries(state));
    const id = TOPICS[0].id;
    state.topics[id] = { ...state.topics[id], status: "done", completedHours: TOPICS[0].plannedHours };
    const after = overallReadiness(entries(state));
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("does not decrease when confidence increases", () => {
    const state = buildInitialState();
    const before = overallReadiness(entries(state));
    for (const seed of TOPICS) state.topics[seed.id] = { ...state.topics[seed.id], confidence: 5 };
    const after = overallReadiness(entries(state));
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("does not decrease when completed hours increase", () => {
    const state = buildInitialState();
    const before = overallReadiness(entries(state));
    const id = TOPICS[1].id;
    state.topics[id] = { ...state.topics[id], completedHours: state.topics[id].completedHours + 5 };
    const after = overallReadiness(entries(state));
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("is bounded between 0 and 1", () => {
    const state = buildInitialState();
    const r = overallReadiness(entries(state));
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});
