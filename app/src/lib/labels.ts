// Plain-text wording for the UI (no emojis, no technical jargon).
// Status/confidence labels come from the single source of truth in
// data/topicOptions.ts; only presentational tone mapping lives here.
import type { DayMode, IncludeValue, StudyMode, StudyTaskType, Tier, TopicStatus } from "../types/planner";
import type { BadgeTone } from "../components/common/Badge";

export {
  getStatusLabel,
  getConfidenceLabel,
  getConfidenceShortLabel,
} from "../data/topicOptions";
export { getDayModeLabel } from "../data/dayModes";

// Subtle, non-alarming tones for day modes (Normal shows no badge in the UI).
export const DAY_MODE_TONE: Record<DayMode, BadgeTone> = {
  normal: "neutral",
  "not-in-mood": "neutral",
  family: "warning",
  travel: "primary",
  work: "neutral",
};

export const STATUS_TONE: Record<TopicStatus, BadgeTone> = {
  "not-started": "neutral",
  studying: "primary",
  practicing: "primary",
  reviewing: "warning",
  done: "success",
  skipped: "rest",
};

export const INCLUDE_LABEL: Record<IncludeValue, string> = {
  Yes: "Yes",
  Later: "Later",
  No: "No",
};

export const TIER_TONE: Record<Tier, BadgeTone> = {
  1: "danger",
  2: "warning",
  3: "neutral",
};

export const MODE_LABEL: Record<StudyMode, string> = {
  Normal: "Focused study",
  "Low Energy": "Light review",
  Family: "Family time",
  Rest: "Rest day",
};

// Multi-task daily plan block labels + gentle tones (no alarming colors).
export const TASK_TYPE_LABEL: Record<StudyTaskType, string> = {
  learn: "Learn",
  review: "Review",
  practice: "Practice",
  "formula-review": "Formulas",
  "mixed-practice": "Mixed practice",
  "light-review": "Light review",
};

export const TASK_TYPE_TONE: Record<StudyTaskType, BadgeTone> = {
  learn: "primary",
  review: "warning",
  practice: "success",
  "formula-review": "neutral",
  "mixed-practice": "success",
  "light-review": "neutral",
};

export function prepLevel(readiness: number): { label: string; tone: BadgeTone } {
  if (readiness < 0.25) return { label: "Just starting", tone: "danger" };
  if (readiness < 0.5) return { label: "Building up", tone: "warning" };
  if (readiness < 0.75) return { label: "Getting there", tone: "primary" };
  if (readiness < 0.9) return { label: "Almost ready", tone: "success" };
  return { label: "Exam ready", tone: "success" };
}

// Note: pacing (Ahead / On Track / Behind) is still computed internally and used
// by the scheduler. It is intentionally NOT surfaced as user-facing wording here
// anymore - the dashboard shows a supportive daily message instead. See
// data/motivationalMessages.ts and components/dashboard/SummaryCards.tsx.
