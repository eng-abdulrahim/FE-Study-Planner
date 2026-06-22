import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { isDirty } from "./autoPush";
import {
  changeDayTopicIn,
  clearDayIn,
  clearWeekIn,
  lockDayIn,
  moveTopicToTodayIn,
  setDayMinutesIn,
  setDayModeIn,
  skipDayIn,
  unlockDayIn,
  unskipDayIn,
} from "./dayOverrides";

const D = "2026-06-22";

describe("day overrides (pure transforms)", () => {
  it("stores each day mode and clears back to normal", () => {
    let s = buildInitialState();
    for (const mode of ["not-in-mood", "family", "travel", "work"] as const) {
      s = setDayModeIn(s, D, mode, "t");
      expect(s.dayOverrides[D].mode).toBe(mode);
    }
    s = setDayModeIn(s, D, "normal", "t");
    expect(s.dayOverrides[D]).toBeUndefined();
  });

  it("returns the same reference on a no-op mode change", () => {
    const s = setDayModeIn(buildInitialState(), D, "work", "t");
    expect(setDayModeIn(s, D, "work", "t2")).toBe(s);
  });

  it("skips and un-skips a day", () => {
    let s = skipDayIn(buildInitialState(), D, "t");
    expect(s.dayOverrides[D].status).toBe("skipped");
    s = unskipDayIn(s, D, "t");
    expect(s.dayOverrides[D]).toBeUndefined();
  });

  it("keeps the mode when un-skipping a day that also has a mode", () => {
    let s = setDayModeIn(buildInitialState(), D, "family", "t");
    s = skipDayIn(s, D, "t");
    s = unskipDayIn(s, D, "t");
    expect(s.dayOverrides[D].mode).toBe("family");
    expect(s.dayOverrides[D].status).toBeUndefined();
  });

  it("change topic locks the day; clearDay resets it", () => {
    let s = changeDayTopicIn(buildInitialState(), D, "1.1", "t");
    expect(s.dayOverrides[D].topicId).toBe("1.1");
    expect(s.dayOverrides[D].locked).toBe(true);
    s = clearDayIn(s, D);
    expect(s.dayOverrides[D]).toBeUndefined();
  });

  it("move-to-today pins a topic onto today and marks the source", () => {
    const s = moveTopicToTodayIn(buildInitialState(), "2026-06-21", D, "1.2", "t");
    expect(s.dayOverrides["2026-06-21"].topicId).toBe("1.2");
    expect(s.dayOverrides["2026-06-21"].locked).toBe(true);
    expect(s.dayOverrides[D].movedToToday).toBe(true);
  });

  it("sets planned minutes clamped to [5, max]", () => {
    const s = buildInitialState();
    expect(setDayMinutesIn(s, D, 25, 60).dayOverrides[D].plannedMinutes).toBe(25);
    expect(setDayMinutesIn(s, D, 2, 60).dayOverrides[D].plannedMinutes).toBe(5);
    expect(setDayMinutesIn(s, D, 999, 60).dayOverrides[D].plannedMinutes).toBe(60);
    const a = setDayMinutesIn(s, D, 25, 60);
    expect(setDayMinutesIn(a, D, 25, 60)).toBe(a); // no-op same ref
  });

  it("locks a day (pins current topic) and unlocks while keeping the pin", () => {
    let s = lockDayIn(buildInitialState(), D, "1.1");
    expect(s.dayOverrides[D].locked).toBe(true);
    expect(s.dayOverrides[D].topicId).toBe("1.1");
    s = unlockDayIn(s, D);
    expect(s.dayOverrides[D].locked).toBeUndefined();
    expect(s.dayOverrides[D].topicId).toBe("1.1");
  });
});

describe("clear week", () => {
  const A = "2026-06-22";
  const B = "2026-06-23";

  it("clear week removes ALL overrides including locked", () => {
    let s = buildInitialState();
    s = setDayModeIn(s, A, "travel", "t");
    s = lockDayIn(s, B, "1.1");
    const cleared = clearWeekIn(s, [A, B]);
    expect(cleared.dayOverrides[A]).toBeUndefined();
    expect(cleared.dayOverrides[B]).toBeUndefined();
  });

  it("is a no-op (same ref) when there is nothing to clear", () => {
    const s = buildInitialState();
    expect(clearWeekIn(s, [A, B])).toBe(s);
  });
});

describe("day overrides + sync dirtiness", () => {
  it("a real day-mode change makes local state dirty (schedules auto-save)", () => {
    const before = buildInitialState();
    const changed = setDayModeIn(before, D, "family", "t");
    expect(changed).not.toBe(before);
    // PlannerContext.update() then bumps lastUpdatedAt for a real change:
    const localUpdatedAt = "2026-06-22T10:00:00.000Z";
    expect(isDirty(localUpdatedAt, before.lastUpdatedAt)).toBe(true);
  });

  it("cloud import keeps lastUpdatedAt so auto-push cannot loop", () => {
    const importedUpdatedAt = "2026-06-20T00:00:00.000Z";
    // After a pull the engine sets lastSyncedLocalUpdatedAt to the same value.
    expect(isDirty(importedUpdatedAt, importedUpdatedAt)).toBe(false);
  });
});
