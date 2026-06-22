import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GentleReminderCard } from "./GentleReminderCard";
import { getDailyMotivationalMessage } from "../../data/motivationalMessages";

const html = renderToStaticMarkup(createElement(GentleReminderCard));

describe("GentleReminderCard", () => {
  it("renders the gentle reminder label, daily message and caption", () => {
    expect(html).toContain(">Gentle reminder<");
    expect(html).toContain(getDailyMotivationalMessage());
    expect(html).toContain("study note");
  });

  it("renders as a soft note card, not a metric stat", () => {
    expect(html).toContain("reminder-card");
    expect(html).not.toContain("stat-value");
  });
});
