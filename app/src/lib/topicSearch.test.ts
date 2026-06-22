import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { computeTopics } from "./plannerLogic";
import { filterTopics, topicSections } from "./topicSearch";

const topics = computeTopics(buildInitialState());

describe("topicSearch.filterTopics", () => {
  it("returns everything when no query/section is set", () => {
    expect(filterTopics(topics, {})).toHaveLength(topics.length);
    expect(filterTopics(topics, { query: "  ", section: "all" })).toHaveLength(topics.length);
  });

  it("matches on topic name (case-insensitive)", () => {
    const sample = topics[0].seed.topicName.slice(0, 4).toLowerCase();
    const result = filterTopics(topics, { query: sample });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.seed.topicName.toLowerCase().includes(sample) || t.seed.section.toLowerCase().includes(sample))).toBe(true);
  });

  it("restricts to a single section", () => {
    const section = topics[0].seed.section;
    const result = filterTopics(topics, { section });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.seed.section === section)).toBe(true);
  });

  it("returns an empty array when nothing matches (clean empty state)", () => {
    expect(filterTopics(topics, { query: "zzzz-no-such-topic" })).toHaveLength(0);
  });

  it("lists unique sections", () => {
    const sections = topicSections(topics);
    expect(sections.length).toBe(new Set(sections).size);
    expect(sections).toContain(topics[0].seed.section);
  });
});
