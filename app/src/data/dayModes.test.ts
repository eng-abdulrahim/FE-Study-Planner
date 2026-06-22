import { describe, it, expect } from "vitest";
import {
  DAY_MODE_OPTIONS,
  applyDayMode,
  describeTodayMode,
  getDayModeLabel,
  isDayMode,
  isSoftMissDay,
  normalizeDayMode,
} from "./dayModes";

describe("day mode options", () => {
  it("exposes normal plus the four real-life modes with labels", () => {
    expect(DAY_MODE_OPTIONS.map((o) => o.value)).toEqual([
      "normal",
      "not-in-mood",
      "family",
      "travel",
      "work",
    ]);
    expect(getDayModeLabel("not-in-mood")).toBe("Not in mood");
    expect(getDayModeLabel("family")).toBe("Family");
    expect(getDayModeLabel("travel")).toBe("Travel");
    expect(getDayModeLabel("work")).toBe("Work");
  });

  it("normalizes unknown values to normal", () => {
    expect(normalizeDayMode("travel")).toBe("travel");
    expect(normalizeDayMode("xyz")).toBe("normal");
    expect(normalizeDayMode(undefined)).toBe("normal");
    expect(isDayMode("work")).toBe(true);
    expect(isDayMode("nope")).toBe(false);
  });
});

describe("applyDayMode reduces and caps the session", () => {
  it("keeps the base unchanged for normal", () => {
    expect(applyDayMode(35, 60, "normal")).toEqual({ suggestedMinutes: 35, task: "" });
  });

  it("caps each mode and never exceeds availability or increases the base", () => {
    expect(applyDayMode(35, 60, "not-in-mood").suggestedMinutes).toBe(20);
    expect(applyDayMode(35, 60, "family").suggestedMinutes).toBe(15);
    expect(applyDayMode(35, 60, "travel").suggestedMinutes).toBe(20);
    expect(applyDayMode(60, 60, "work").suggestedMinutes).toBe(30);
    expect(applyDayMode(35, 10, "work").suggestedMinutes).toBe(10); // availability wins
    expect(applyDayMode(8, 60, "not-in-mood").suggestedMinutes).toBe(8); // never increased
  });

  it("swaps in the lighter task text", () => {
    expect(applyDayMode(35, 60, "not-in-mood").task).toContain("Low-energy");
    expect(applyDayMode(35, 60, "travel").task.toLowerCase()).toContain("travel");
  });
});

describe("describeTodayMode / soft miss", () => {
  it("returns Today guidance for special modes and null for normal", () => {
    expect(describeTodayMode("normal")).toBeNull();
    const fam = describeTodayMode("family")!;
    expect(fam.label).toBe("Family");
    expect(fam.shortTask).toBe("Light review");
    expect(fam.message).toContain("Family day");
    expect(describeTodayMode("travel")!.shortTask).toBe("Mobile review");
    expect(describeTodayMode("work")!.shortTask).toBe("Short focused session");
    expect(describeTodayMode("not-in-mood")!.shortTask).toBe("Quick review");
  });

  it("treats family/travel/not-in-mood as soft-miss days, work/normal as hard", () => {
    expect(isSoftMissDay("family")).toBe(true);
    expect(isSoftMissDay("travel")).toBe(true);
    expect(isSoftMissDay("not-in-mood")).toBe(true);
    expect(isSoftMissDay("work")).toBe(false);
    expect(isSoftMissDay("normal")).toBe(false);
  });
});
