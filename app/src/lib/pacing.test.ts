import { describe, it, expect } from "vitest";
import { computePacing, requiredWeeklyHours } from "./pacing";

describe("pacing", () => {
  it("required weekly hours increase as the exam gets closer", () => {
    const remaining = 40;
    const far = requiredWeeklyHours(remaining, "2026-04-01", "2026-01-01"); // ~13 weeks
    const near = requiredWeeklyHours(remaining, "2026-02-01", "2026-01-01"); // ~4.4 weeks
    expect(near).toBeGreaterThan(far);
  });

  it("flags Behind when availability is well under the requirement", () => {
    const p = computePacing({
      examDate: "2026-02-01",
      today: "2026-01-01",
      plannedTotalHours: 50,
      completedHours: 10,
      remainingHours: 40,
      availableWeeklyHours: 3,
      plannedWeeklyHours: 3,
    });
    expect(p.paceStatus).toBe("Behind");
    expect(p.daysRemaining).toBeGreaterThan(0);
  });

  it("never reports negative days and marks the exam as passed", () => {
    const p = computePacing({
      examDate: "2025-12-01",
      today: "2026-01-01",
      plannedTotalHours: 50,
      completedHours: 50,
      remainingHours: 0,
      availableWeeklyHours: 5,
      plannedWeeklyHours: 5,
    });
    expect(p.daysRemaining).toBe(0);
    expect(p.examPassed).toBe(true);
    expect(p.paceStatus).toBe("Exam Passed");
  });
});
