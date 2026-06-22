// Tests for the canonical dashboard summary (model.summary). These prove the
// top cards are derived from real planner state and move correctly as progress
// changes - completing a block raises Completed and lowers Remaining, Undo
// reverses it exactly, the exam date drives Days remaining, and "This week"
// counts the blocks the user actually sees in the weekly plan.
import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { buildModel } from "./plannerLogic";
import { setTaskDoneIn, resetTaskIn } from "./planActions";
import type { PlannerState } from "../types/planner";

// A Monday (matches the project's default availability so today has blocks).
const TODAY = "2026-06-22";

function stateWithExam(date: string): PlannerState {
  return { ...buildInitialState(), examDate: date };
}

describe("model.summary - days remaining", () => {
  it("counts whole days from today to a future exam date", () => {
    const s = buildModel(stateWithExam("2026-07-22"), TODAY).summary;
    expect(s.daysRemaining).toBe(30);
    expect(s.examPassed).toBe(false);
  });

  it("shows 0 when the exam is today", () => {
    const s = buildModel(stateWithExam(TODAY), TODAY).summary;
    expect(s.daysRemaining).toBe(0);
    expect(s.examPassed).toBe(false);
  });

  it("clamps to 0 and flags examPassed when the date is in the past", () => {
    const s = buildModel(stateWithExam("2026-06-01"), TODAY).summary;
    expect(s.daysRemaining).toBe(0);
    expect(s.examPassed).toBe(true);
  });
});

describe("model.summary - completed / remaining hours", () => {
  it("starts at zero completed and a positive planned total", () => {
    const s = buildModel(stateWithExam("2026-08-30"), TODAY).summary;
    expect(s.completedHours).toBe(0);
    expect(s.plannedTotalHours).toBeGreaterThan(0);
    expect(s.remainingHours).toBeCloseTo(s.plannedTotalHours, 6);
  });

  it("raises Completed and lowers Remaining when a topic block is done", () => {
    const state = stateWithExam("2026-08-30");
    const base = buildModel(state, TODAY).summary;
    const task = buildModel(state, TODAY).todayStudyPlan!.tasks.find((t) => t.topicId)!;

    const done = buildModel(setTaskDoneIn(state, TODAY, task, () => "log1"), TODAY).summary;

    expect(done.completedHours).toBeCloseTo(task.plannedMinutes / 60, 5);
    expect(done.remainingHours).toBeCloseTo(base.remainingHours - task.plannedMinutes / 60, 5);
    expect(done.remainingHours).toBeLessThan(base.remainingHours);
    // Completed + Remaining always reconciles to the planned total.
    expect(done.completedHours + done.remainingHours).toBeCloseTo(base.plannedTotalHours, 5);
  });

  it("reverses exactly on Undo, never going negative", () => {
    const state = stateWithExam("2026-08-30");
    const base = buildModel(state, TODAY).summary;
    const task = buildModel(state, TODAY).todayStudyPlan!.tasks.find((t) => t.topicId)!;

    const doneState = setTaskDoneIn(state, TODAY, task, () => "log1");
    const undone = buildModel(resetTaskIn(doneState, task), TODAY).summary;

    expect(undone.completedHours).toBe(0);
    expect(undone.remainingHours).toBeCloseTo(base.remainingHours, 5);
    expect(undone.completedHours).toBeGreaterThanOrEqual(0);
    expect(undone.remainingHours).toBeGreaterThanOrEqual(0);
  });
});

describe("model.summary - preparation (hours-based study progress)", () => {
  it("starts at 0% on a fresh plan (same source as Completed)", () => {
    const s = buildModel(buildInitialState(), TODAY).summary;
    expect(s.preparationPercent).toBe(0);
    expect(s.completedHours).toBe(0);
    expect(s.preparationLabel.length).toBeGreaterThan(0);
  });

  it("reaches 100% once every included topic's hours are complete", () => {
    const full = stateWithExam("2026-08-30");
    const topics = { ...full.topics };
    for (const id of Object.keys(topics)) {
      if (topics[id].include !== "No") topics[id] = { ...topics[id], completedHours: 9999 };
    }
    const s = buildModel({ ...full, topics }, TODAY).summary;
    expect(s.preparationPercent).toBe(100);
    expect(Number.isInteger(s.preparationPercent)).toBe(true);
  });

  it("never decreases when a block is completed (progress is monotonic)", () => {
    const state = stateWithExam("2026-08-30");
    const base = buildModel(state, TODAY).summary;
    const task = buildModel(state, TODAY).todayStudyPlan!.tasks.find((t) => t.topicId)!;

    const done = buildModel(setTaskDoneIn(state, TODAY, task, () => "log1"), TODAY).summary;
    expect(done.preparationPercent).toBeGreaterThanOrEqual(base.preparationPercent);
    expect(done.preparationPercent).toBeLessThanOrEqual(100);
  });
});

describe("model.summary - this week", () => {
  it("counts done blocks (and their minutes) from the visible weekly plan", () => {
    const state = stateWithExam("2026-08-30");
    const before = buildModel(state, TODAY).summary;
    expect(before.weeklyCompletedCount).toBe(0);
    expect(before.weeklyTotalCount).toBeGreaterThan(0);
    expect(before.weeklyCompletedMinutes).toBe(0);

    const task = buildModel(state, TODAY).todayStudyPlan!.tasks[0];
    const after = buildModel(setTaskDoneIn(state, TODAY, task, () => "log1"), TODAY).summary;

    expect(after.weeklyCompletedCount).toBeGreaterThanOrEqual(1);
    expect(after.weeklyCompletedMinutes).toBeGreaterThan(0);
    expect(after.weeklyCompletedCount).toBeLessThanOrEqual(after.weeklyTotalCount);
  });

  it("returns to zero when the block is undone", () => {
    const state = stateWithExam("2026-08-30");
    const task = buildModel(state, TODAY).todayStudyPlan!.tasks[0];
    const doneState = setTaskDoneIn(state, TODAY, task, () => "log1");
    const after = buildModel(resetTaskIn(doneState, task), TODAY).summary;

    expect(after.weeklyCompletedCount).toBe(0);
    expect(after.weeklyCompletedMinutes).toBe(0);
  });
});

describe("model.summary - safety", () => {
  it("produces finite, non-negative values with no NaN on a fresh state", () => {
    const s = buildModel(buildInitialState(), TODAY).summary;
    for (const v of [
      s.daysRemaining,
      s.completedHours,
      s.plannedTotalHours,
      s.remainingHours,
      s.preparationPercent,
      s.weeklyCompletedCount,
      s.weeklyTotalCount,
      s.weeklyCompletedMinutes,
    ]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
