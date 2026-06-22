// Pure topic filtering for the Change-topic picker. Matches on topic name and
// section (case-insensitive), with an optional section filter. Kept separate so
// the picker UI stays thin and the matching logic is unit-testable.
import type { ComputedTopic } from "../types/planner";

export interface TopicFilter {
  query?: string;
  section?: string; // "all" or a section name
}

export function filterTopics(topics: ComputedTopic[], filter: TopicFilter): ComputedTopic[] {
  const needle = (filter.query ?? "").trim().toLowerCase();
  const section = filter.section ?? "all";
  return topics.filter((t) => {
    if (section !== "all" && t.seed.section !== section) return false;
    if (!needle) return true;
    return (
      t.seed.topicName.toLowerCase().includes(needle) ||
      t.seed.section.toLowerCase().includes(needle)
    );
  });
}

/** Unique section names, in first-seen order. */
export function topicSections(topics: ComputedTopic[]): string[] {
  const seen: string[] = [];
  for (const t of topics) if (!seen.includes(t.seed.section)) seen.push(t.seed.section);
  return seen;
}
