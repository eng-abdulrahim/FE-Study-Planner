// Default planner data recreated from the workbook (_Lists, _Calc, Dashboard inputs).
import type {
  DayAvailability,
  IncludeValue,
  PlannerState,
  PlanTuning,
  StudyMode,
  Tier,
  TopicSeed,
  TopicState,
  TopicStatus,
} from "../types/planner";
import { STORAGE_VERSION } from "../types/planner";
import { TOPICS } from "./topics";

export const EXAM_NAME = "FE Electrical & Computer";
export const DEFAULT_EXAM_DATE = "2026-07-22";

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const INCLUDE_VALUES: IncludeValue[] = ["Yes", "Later", "No"];

// Monotonic status -> progress mapping used by the (fixed) Readiness model.
// Values follow the spec's intent that moving a topic forward never lowers its
// progress. (Canonical status values live in data/topicOptions.ts.)
export const STATUS_PROGRESS: Record<TopicStatus, number> = {
  "not-started": 0,
  studying: 0.35,
  practicing: 0.65,
  reviewing: 0.9,
  done: 1.0,
  skipped: 0,
};

export const TIER_BONUS: Record<Tier, number> = { 1: 5, 2: 3, 3: 1 };
export const TIER_LABEL: Record<Tier, string> = {
  1: "Tier 1 - High yield",
  2: "Tier 2 - Medium",
  3: "Tier 3 - Low yield",
};

export const MODES: StudyMode[] = ["Normal", "Low Energy", "Family", "Rest"];

// Per-mode session minute limits [min, max].
export const MODE_MINUTES: Record<StudyMode, { min: number; max: number }> = {
  Normal: { min: 25, max: 45 },
  "Low Energy": { min: 10, max: 20 },
  Family: { min: 20, max: 45 },
  Rest: { min: 0, max: 0 },
};

// Next-action thresholds on the priority score (from workbook _Calc).
export const ACTION_THRESHOLDS = {
  studyNext: 6,
  studyThisWeek: 4.5,
  practice: 3,
};

// Task templates (from _Lists).
export const NORMAL_TASKS = [
  "Study the core concept, then solve 2-4 example problems.",
  "Review key formulas, then practice short FE-style problems.",
  "Target your common mistakes, then update your confidence.",
];

export const LOW_ENERGY_TASKS = [
  "FE Handbook formula lookup (10-15 min).",
  "Review one fully solved example (10-20 min).",
  "Mistake review of your last topic (15-20 min).",
  "Flashcard review of definitions (10-15 min).",
  "Light Ethics review - 3.1/3.2/3.3 (15-20 min).",
  "Engineering Economics formula drill (15-25 min).",
];

export const REVIEW_TASKS = [
  "Timed mini-set: solve 3-5 FE-style problems, then check.",
  "Redo previously missed problems for this topic.",
  "Formula recall + one worked example, no notes.",
];

export function familyTask(topicName: string): string {
  return `Light review of ${topicName}. Read notes / one example, no heavy problem solving.`;
}

export function restTask(): string {
  return "Rest day - no study planned. Recharge so the next session counts.";
}

// Default weekly availability (Dashboard G20:I26 in the workbook).
export const DEFAULT_AVAILABILITY: DayAvailability[] = [
  { weekdayIndex: 0, dayName: "Sunday", minutes: 30, energy: 2, mode: "Normal" },
  { weekdayIndex: 1, dayName: "Monday", minutes: 35, energy: 3, mode: "Normal" },
  { weekdayIndex: 2, dayName: "Tuesday", minutes: 30, energy: 2, mode: "Normal" },
  { weekdayIndex: 3, dayName: "Wednesday", minutes: 35, energy: 3, mode: "Normal" },
  { weekdayIndex: 4, dayName: "Thursday", minutes: 25, energy: 2, mode: "Low Energy" },
  { weekdayIndex: 5, dayName: "Friday", minutes: 30, energy: 3, mode: "Family" },
  { weekdayIndex: 6, dayName: "Saturday", minutes: 45, energy: 4, mode: "Family" },
];

// All plan-shaping nudges off by default (the engine produces the balanced plan).
export const DEFAULT_PLAN_TUNING: PlanTuning = {
  lightDay: false,
  morePractice: false,
  moreReview: false,
  focusWeak: false,
  includeAll: false,
};

export function initialTopicState(seed: TopicSeed): TopicState {
  return {
    include: seed.includeDefault,
    confidence: seed.defaultConfidence,
    boredom: seed.defaultBoredom,
    quickWin: seed.defaultQuickWin,
    difficulty: seed.defaultDifficulty,
    status: seed.defaultStatus,
    completedHours: 0,
    noteUrl: "",
  };
}

export function buildInitialState(): PlannerState {
  const topics: Record<string, TopicState> = {};
  for (const seed of TOPICS) topics[seed.id] = initialTopicState(seed);
  return {
    version: STORAGE_VERSION,
    examName: EXAM_NAME,
    examDate: DEFAULT_EXAM_DATE,
    dailyAvailability: DEFAULT_AVAILABILITY.map((d) => ({ ...d })),
    topics,
    studyLog: [],
    backlog: [],
    dayOverrides: {},
    taskStatus: {},
    planTuning: { ...DEFAULT_PLAN_TUNING },
    planSeed: 0,
    ui: { weekStartDay: 0, reviewWindowDays: 14 },
    lastUpdatedAt: null,
    lastSaved: null,
  };
}
