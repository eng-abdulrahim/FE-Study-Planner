import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The cards read exclusively from the canonical `model.summary`, so the mock
// only needs to provide that one object. The values below exercise hour, percent
// and week-ratio formatting at the display edge.
vi.mock("../../state/PlannerContext", () => ({
  usePlanner: () => ({
    state: { examName: "Final Exam" },
    model: {
      summary: {
        daysRemaining: 42,
        examPassed: false,
        completedHours: 12.3,
        plannedTotalHours: 100,
        remainingHours: 87.7,
        preparationPercent: 42,
        preparationLabel: "Building up",
        weeklyCompletedCount: 3,
        weeklyTotalCount: 12,
        weeklyCompletedMinutes: 120,
      },
    },
  }),
}));

const { SummaryCards } = await import("./SummaryCards");
const html = renderToStaticMarkup(createElement(SummaryCards));

describe("SummaryCards (metrics only)", () => {
  it("does not render any discouraging pace text", () => {
    expect(html).not.toContain("Behind schedule");
    expect(html).not.toContain("vs your availability");
    // No "Pace" stat card label remains.
    expect(html).not.toContain(">Pace<");
  });

  it("does not render the gentle reminder (it moved to the upper grid)", () => {
    expect(html).not.toContain("Gentle reminder");
    expect(html).not.toContain("stat--motivation");
  });

  it("still renders the supportive numeric summary cards", () => {
    expect(html).toContain(">Days remaining<");
    expect(html).toContain(">Preparation<");
    expect(html).toContain(">This week<");
  });

  it("renders the formatted summary values from model.summary", () => {
    expect(html).toContain(">42<"); // days remaining
    expect(html).toContain(">12.3h<"); // completed hours
    expect(html).toContain("of 100h"); // planned total
    expect(html).toContain(">87.7h<"); // remaining hours
    expect(html).toContain(">42%<"); // preparation percent
    expect(html).toContain("Building up"); // preparation label
    expect(html).toContain(">3/12<"); // weekly blocks done / total
    expect(html).toContain("2h done"); // 120 min formatted
  });
});
