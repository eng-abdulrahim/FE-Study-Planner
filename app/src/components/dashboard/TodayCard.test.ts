import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DailyStudyPlan, DailyStudyTask } from "../../types/planner";

// The Today card is deliberately limited to three controls: Mark Done / Undo
// Done, Day mode, and Skip today. These tests render it with a mocked planner
// and assert exactly that surface (and the removal of Change topic / Options).
let plan: DailyStudyPlan | undefined;
const noop = () => {};
const actions = {
  setDayMode: noop,
  setDayDone: noop,
  resetDayDone: noop,
  skipDay: noop,
  unskipDay: noop,
  setTaskDone: noop,
  skipTask: noop,
  resetTask: noop,
};

vi.mock("../../state/PlannerContext", () => ({
  usePlanner: () => ({
    today: "2026-06-22",
    state: {},
    model: {
      todayStudyPlan: plan,
      coverage: {
        totalTopics: 10,
        coveredTopics: 3,
        remainingTopics: 7,
        weakRemaining: 2,
        highPriorityRemaining: 1,
      },
      adaptive: {
        mode: "soft-start",
        riskLevel: "low",
        catchUpPressure: 0,
        momentum: 0,
        requiredDailyHours: 1,
        requiredWeeklyHours: 7,
        minimumMinutes: 30,
        recommendedMinutes: 45,
        recoveryMinutes: 60,
        headline: "Soft start",
        message: "Begin with one small, calm session today.",
        honestLine: null,
        focusStrategy: [],
      },
    },
    actions,
  }),
}));

const { TodayCard } = await import("./TodayCard");

function task(over: Partial<DailyStudyTask> = {}): DailyStudyTask {
  return {
    id: "2026-06-22|learn|t1",
    topicId: "t1",
    title: "Kirchhoff Laws",
    section: "Circuit Analysis",
    type: "learn",
    plannedMinutes: 35,
    reason: "Start with one clear idea.",
    status: "planned",
    ...over,
  };
}

function basePlan(over: Partial<DailyStudyPlan> = {}): DailyStudyPlan {
  return {
    date: "2026-06-22",
    dayName: "Monday",
    isToday: true,
    dayMode: "normal",
    studyMode: "Normal",
    phase: "build",
    totalPlannedMinutes: 60,
    doneMinutes: 0,
    tasks: [
      task(),
      task({ id: "2026-06-22|review|t2", topicId: "t2", title: "Complex Numbers", type: "review", plannedMinutes: 25 }),
    ],
    focusMessage: "A steady, focused session ahead.",
    isRest: false,
    isSkipped: false,
    ...over,
  };
}

const render = () => renderToStaticMarkup(createElement(TodayCard));

describe("TodayCard - exactly three controls", () => {
  it("renders Mark Done, Day mode and Skip today on a planned day", () => {
    plan = basePlan();
    const html = render();
    expect(html).toContain("Mark Done");
    expect(html).toContain("Day mode");
    expect(html).toContain("Skip today");
  });

  it("does not render Change topic, Options or a Plan menu", () => {
    plan = basePlan();
    const html = render();
    expect(html).not.toContain("Change topic");
    expect(html).not.toContain("Options");
    expect(html).not.toContain(">Plan<");
  });

  it("renders no planned-time editor - only a read-only duration", () => {
    plan = basePlan();
    const html = render();
    // Read-only duration summary stays.
    expect(html).toContain("blocks");
    // No editable planned-time controls of any kind.
    expect(html).not.toContain("Planned time");
    expect(html).not.toContain("Adjust time");
    expect(html).not.toContain("stepper");
    expect(html).not.toContain("Less time");
    expect(html).not.toContain("More time");
  });

  it("shows the blocks + focus message but no per-block Done/Skip buttons", () => {
    plan = basePlan();
    const html = render();
    expect(html).toContain("Kirchhoff Laws");
    expect(html).toContain("Complex Numbers");
    expect(html).toContain("focused session");
    // The read-only Today list never renders per-block action buttons.
    expect(html).not.toContain(">Done<");
    expect(html).not.toContain(">Skip<");
  });

  it("switches the primary action to Undo Done when every block is done", () => {
    plan = basePlan({
      doneMinutes: 60,
      tasks: [
        task({ status: "done" }),
        task({ id: "2026-06-22|review|t2", topicId: "t2", title: "Complex Numbers", type: "review", status: "done" }),
      ],
    });
    const html = render();
    expect(html).toContain("Undo Done");
    expect(html).not.toContain("Mark Done");
  });

  it("shows Unskip today and hides Mark Done on a skipped day", () => {
    plan = basePlan({ isSkipped: true, tasks: [] });
    const html = render();
    expect(html).toContain("Unskip today");
    expect(html).toContain("Day mode");
    expect(html).not.toContain("Mark Done");
  });

  it("shows a subtle day-mode badge only when the mode is not normal", () => {
    plan = basePlan({ dayMode: "normal" });
    expect(render()).not.toContain(">Travel<");
    plan = basePlan({ dayMode: "travel" });
    expect(render()).toContain(">Travel<");
  });
});
