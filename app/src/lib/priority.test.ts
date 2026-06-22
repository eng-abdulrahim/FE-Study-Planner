import { describe, it, expect } from "vitest";
import type { TopicSeed, TopicState } from "../types/planner";
import { computePriority } from "./priority";

function seed(over: Partial<TopicSeed> = {}): TopicSeed {
  return {
    id: "x",
    rowOrder: 1,
    section: "S",
    sectionNumber: 1,
    topicName: "T",
    qRange: null,
    examWeight: 7,
    tier: 2,
    defaultConfidence: 3,
    defaultDifficulty: 3,
    defaultBoredom: 3,
    defaultQuickWin: 3,
    recommendedDepth: null,
    plannedHours: 2,
    includeDefault: "Yes",
    defaultStatus: "not-started",
    notes: null,
    ...over,
  };
}

function st(over: Partial<TopicState> = {}): TopicState {
  return {
    include: "Yes",
    confidence: 3,
    boredom: 3,
    quickWin: 3,
    difficulty: 3,
    status: "not-started",
    completedHours: 0,
    noteUrl: "",
    ...over,
  };
}

describe("priority", () => {
  it("increases when confidence decreases", () => {
    const high = computePriority(seed(), st({ confidence: 4 }));
    const low = computePriority(seed(), st({ confidence: 2 }));
    expect(low).toBeGreaterThan(high);
  });

  it("is 0 when Include = No", () => {
    expect(computePriority(seed(), st({ include: "No" }))).toBe(0);
  });

  it("is strongly reduced for Done topics", () => {
    const active = computePriority(seed(), st({ status: "studying" }));
    const done = computePriority(seed(), st({ status: "done" }));
    expect(done).toBeLessThanOrEqual(active * 0.2);
    expect(done).toBeLessThan(active);
  });

  it("is 0 when status = skipped", () => {
    expect(computePriority(seed(), st({ status: "skipped" }))).toBe(0);
  });

  it("halves with Include = Later", () => {
    const yes = computePriority(seed(), st({ include: "Yes" }));
    const later = computePriority(seed(), st({ include: "Later" }));
    expect(later).toBeCloseTo(yes * 0.5, 5);
  });
});
