// Formatting helpers for the summary cards. These guard the display edge so the
// cards stay clean and safe even with messy inputs (negatives, NaN, zero totals).
import { describe, it, expect } from "vitest";
import { formatHours, formatPercent, formatWeekProgress } from "./util";

describe("formatHours", () => {
  it("formats whole and fractional hours without long decimals", () => {
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(0.5)).toBe("0.5h");
    expect(formatHours(12)).toBe("12h");
    expect(formatHours(150.49)).toBe("150.5h");
  });

  it("never shows negative or NaN hours", () => {
    expect(formatHours(-5)).toBe("0h");
    expect(formatHours(Number.NaN)).toBe("0h");
  });
});

describe("formatPercent", () => {
  it("turns a 0..1 fraction into a clamped whole percent", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.123)).toBe("12%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("clamps out-of-range and NaN values", () => {
    expect(formatPercent(1.5)).toBe("100%");
    expect(formatPercent(-0.2)).toBe("0%");
    expect(formatPercent(Number.NaN)).toBe("0%");
  });
});

describe("formatWeekProgress", () => {
  it("renders a done/total ratio", () => {
    expect(formatWeekProgress(3, 7)).toBe("3/7");
    expect(formatWeekProgress(0, 12)).toBe("0/12");
  });

  it("stays safe with zero totals and out-of-range done counts", () => {
    expect(formatWeekProgress(0, 0)).toBe("0/0");
    expect(formatWeekProgress(5, 3)).toBe("3/3");
    expect(formatWeekProgress(-1, 7)).toBe("0/7");
  });
});
