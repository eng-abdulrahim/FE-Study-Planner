import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function topic(id: string, section: string, status: string, include = "Yes") {
  return { seed: { id, section, topicName: id, tier: 2 }, state: { status, include } };
}

// Two sections in the plan (Mathematics partly done, Circuit Analysis untouched)
// plus an excluded Electronics topic that must NOT appear in section coverage.
const computed = [
  topic("m1", "Mathematics", "done"),
  topic("m2", "Mathematics", "not-started"),
  topic("c1", "Circuit Analysis", "not-started"),
  topic("c2", "Circuit Analysis", "not-started"),
  topic("x1", "Electronics", "done", "No"),
];

vi.mock("../../state/PlannerContext", () => ({
  usePlanner: () => ({
    state: { studyLog: [] },
    model: {
      progressPct: 0.25,
      statusDistribution: {
        "not-started": 3,
        studying: 0,
        practicing: 0,
        reviewing: 0,
        done: 1,
        skipped: 0,
      },
      tierDistribution: { 1: 1, 2: 3, 3: 1 },
      weekStudyPlans: [
        { dayName: "Monday", date: "2026-06-22", totalPlannedMinutes: 60 },
        { dayName: "Tuesday", date: "2026-06-23", totalPlannedMinutes: 0 },
      ],
      computed,
    },
  }),
}));

const { ChartsSection } = await import("./ChartsSection");
const html = renderToStaticMarkup(createElement(ChartsSection));

describe("ChartsSection", () => {
  it("renders the four 2x2 chart cards plus the full-width weekly chart", () => {
    expect(html).toContain("Overall progress");
    expect(html).toContain("Status distribution");
    expect(html).toContain("Tier distribution");
    expect(html).toContain("Section coverage");
    expect(html).toContain("Weekly minutes");
  });

  it("fills the previously empty cell: Section coverage has its own card", () => {
    // The Section coverage card sits in the 2x2 grid (not the span-2 weekly row).
    const cardCount = (html.match(/chart-card/g) ?? []).length;
    expect(cardCount).toBe(5); // 4 in the 2x2 + the span-2 weekly
    expect(html).toContain("section-coverage");
  });

  it("shows done/total per section and excludes not-included topics", () => {
    expect(html).toContain("Mathematics");
    expect(html).toContain("Circuit Analysis");
    expect(html).toContain("1 / 2"); // Mathematics: 1 of 2 done
    expect(html).toContain("0 / 2"); // Circuit Analysis: 0 of 2 done (no completed -> no crash)
    expect(html).not.toContain("Electronics"); // include === "No" is excluded
  });
});
