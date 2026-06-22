import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DailyStudyPlan } from "../../types/planner";

// Force the expandable day open so the expanded day controls render in static
// markup. WeeklyDaySummary has a single useState (the open flag).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: () => [true, () => {}] };
});

const noop = () => {};
vi.mock("../../state/PlannerContext", () => ({
  usePlanner: () => ({
    actions: {
      setDayMode: noop,
      skipDay: noop,
      unskipDay: noop,
      regeneratePlan: noop,
      setTaskDone: noop,
      skipTask: noop,
      resetTask: noop,
    },
  }),
}));

const { WeeklyDaySummary } = await import("./WeeklyDaySummary");

function plan(over: Partial<DailyStudyPlan> = {}): DailyStudyPlan {
  return {
    date: "2026-06-23",
    dayName: "Tuesday",
    isToday: false,
    dayMode: "normal",
    studyMode: "Normal",
    phase: "build",
    totalPlannedMinutes: 45,
    doneMinutes: 0,
    tasks: [
      { id: "2026-06-23|learn|t1", topicId: "t1", title: "Diodes", section: "Electronics", type: "learn", plannedMinutes: 25, reason: "Learn.", status: "planned" },
      { id: "2026-06-23|review|t2", topicId: "t2", title: "Op-amps", section: "Electronics", type: "review", plannedMinutes: 20, reason: "Review.", status: "planned" },
    ],
    focusMessage: "A steady plan.",
    isRest: false,
    isSkipped: false,
    ...over,
  };
}

const html = renderToStaticMarkup(createElement(WeeklyDaySummary, { plan: plan() }));

describe("WeeklyDaySummary - read-only time, no time editor", () => {
  it("shows the day total as read-only duration text", () => {
    expect(html).toContain("45m");
  });

  it("exposes day controls (mode, skip, regenerate) but no planned-time editor", () => {
    expect(html).toContain("Mode");
    expect(html).toContain("Skip day");
    expect(html).toContain("Regenerate");
    expect(html).not.toContain("Planned time");
    expect(html).not.toContain("Adjust time");
    expect(html).not.toContain("stepper");
    expect(html).not.toContain("Less time");
    expect(html).not.toContain("More time");
  });
});
