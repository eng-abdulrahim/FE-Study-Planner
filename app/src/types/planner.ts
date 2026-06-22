// Domain types for the FE study planner.

export type IncludeValue = "Yes" | "Later" | "No";

// Canonical topic workflow status. These are the values stored on disk and in
// the cloud. Legacy values ("Learning", "Improving", "Strong", "Exam Ready",
// ...) are migrated to these on hydrate/import via normalizeTopicStatus.
export type TopicStatus =
  | "not-started"
  | "studying"
  | "practicing"
  | "reviewing"
  | "done"
  | "skipped";

/** Self-rated confidence, 1 (Very weak) .. 5 (Strong). */
export type TopicConfidence = 1 | 2 | 3 | 4 | 5;

export type StudyMode = "Normal" | "Low Energy" | "Family" | "Rest";

/**
 * Day-level real-life constraint for a SPECIFIC date. This is separate from
 * `TopicStatus` (workflow state of a topic) and from `StudyMode` (the recurring
 * per-weekday availability). It only adjusts how a single day is planned.
 */
export type DayMode = "normal" | "not-in-mood" | "family" | "travel" | "work";

export type Tier = 1 | 2 | 3;

export type PaceStatus = "Ahead" | "On Track" | "Behind" | "Exam Passed";

export type DayStatus = "planned" | "done" | "missed" | "rest" | "skipped";

/** Per-date user override stored under `PlannerState.dayOverrides[date]`. */
export type DayOverrideStatus = "planned" | "done" | "skipped" | "missed";

export interface DayOverride {
  mode?: DayMode;
  /** A topic the user pinned to this date (overrides the auto pick). */
  topicId?: string;
  status?: DayOverrideStatus;
  /** Manual choices that the scheduler must keep respecting. */
  locked?: boolean;
  plannedMinutes?: number;
  /** Marker: this day's topic was pushed onto Today (visual hint only). */
  movedToToday?: boolean;
  updatedAt: string;
}

export const STORAGE_KEY = "latifah-fe-planner-v1";
export const STORAGE_VERSION = 1;

/** Immutable seed data extracted from the workbook. */
export interface TopicSeed {
  id: string; // e.g. "6.6"
  rowOrder: number; // original workbook order (used as a stable tie-breaker)
  section: string;
  sectionNumber: number | null;
  topicName: string;
  qRange: string | null;
  examWeight: number;
  tier: Tier;
  defaultConfidence: number;
  defaultDifficulty: number;
  defaultBoredom: number;
  defaultQuickWin: number;
  recommendedDepth: string | null;
  plannedHours: number;
  includeDefault: IncludeValue;
  defaultStatus: TopicStatus;
  notes: string | null;
}

/** Per-topic editable user state (persisted). */
export interface TopicState {
  include: IncludeValue;
  confidence: number; // 1-5
  boredom: number; // 1-5
  quickWin: number; // 1-5
  difficulty: number; // 1-5 (from workbook; influences Family-day selection)
  status: TopicStatus;
  completedHours: number; // authoritative completed hours
  noteUrl: string; // may be empty
}

export interface DayAvailability {
  weekdayIndex: number; // 0 = Sunday .. 6 = Saturday
  dayName: string;
  minutes: number;
  energy: number; // 1-5
  mode: StudyMode;
}

export interface StudyLogEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd
  topicId: string | null;
  topicName: string;
  mode: StudyMode;
  minutes: number;
  note?: string;
  /** Set when this entry came from a multi-task daily plan block, so multiple
   *  tasks for the same topic on the same day stay distinct and undo is exact. */
  taskId?: string;
}

// ---- Multi-task daily plan -------------------------------------------------

/** Kind of study block inside a day. */
export type StudyTaskType =
  | "learn"
  | "review"
  | "practice"
  | "formula-review"
  | "mixed-practice"
  | "light-review";

export type DailyTaskStatus = "planned" | "done" | "skipped";

/** A single block within a day's plan (may or may not be tied to a topic). */
export interface DailyStudyTask {
  id: string;
  topicId?: string;
  title: string;
  section?: string;
  type: StudyTaskType;
  plannedMinutes: number;
  reason: string;
  status: DailyTaskStatus;
  noteUrl?: string;
}

/** A full day made of several purpose-built blocks. */
export interface DailyStudyPlan {
  date: string; // ISO yyyy-mm-dd
  dayName: string;
  isToday: boolean;
  dayMode: DayMode;
  studyMode: StudyMode;
  phase: "build" | "final-review";
  totalPlannedMinutes: number;
  doneMinutes: number;
  tasks: DailyStudyTask[];
  focusMessage: string;
  isRest: boolean;
  isSkipped: boolean;
}

/** How much of the syllabus the plan has reached. */
export interface PlanCoverage {
  totalTopics: number;
  coveredTopics: number;
  remainingTopics: number;
  weakRemaining: number;
  highPriorityRemaining: number;
}

/** User nudges that reshape the generated plan without wiping manual choices. */
export interface PlanTuning {
  lightDay: boolean;
  morePractice: boolean;
  moreReview: boolean;
  focusWeak: boolean;
  includeAll: boolean;
}

export interface MissedEntry {
  date: string;
  topicId: string;
  topicName: string;
}

export interface UiPrefs {
  weekStartDay: number; // 0 = Sunday
  reviewWindowDays: number; // default 14
}

export interface PlannerState {
  version: number;
  examName: string;
  examDate: string; // ISO yyyy-mm-dd
  dailyAvailability: DayAvailability[]; // length 7, indexed Sunday..Saturday
  topics: Record<string, TopicState>; // keyed by topic id
  studyLog: StudyLogEntry[];
  backlog: MissedEntry[];
  /** Per-date day modes / constraints, keyed by ISO yyyy-mm-dd. */
  dayOverrides: Record<string, DayOverride>;
  /** Per-task done/skip state, keyed by daily-plan task id. Done topic tasks
   *  also write a studyLog entry; this map is the fast lookup + the home for
   *  general (topic-less) task completion. */
  taskStatus: Record<string, "done" | "skipped">;
  /** Plan-shaping nudges (Light day, More practice, Focus weak, ...). */
  planTuning: PlanTuning;
  /** Monotonic counter bumped by the "Regenerate" action. The daily-plan engine
   *  folds it into its topic rotation, so regenerating reshuffles the auto-picked
   *  review / practice topics while keeping the engine pure + deterministic (a
   *  given seed always yields the same plan). Bumping it also guarantees a real
   *  state change, so Regenerate always saves + triggers the cloud auto-push. */
  planSeed: number;
  ui: UiPrefs;
  /** When the planner DATA last changed by a user edit. Drives sync conflict
   *  detection. Unlike `lastSaved`, it is NOT bumped by automatic persistence
   *  or by loading state from a backup/cloud. */
  lastUpdatedAt: string | null;
  /** When the state was last written to LocalStorage (every save). */
  lastSaved: string | null;
}

// ---- Computed (not persisted) ---------------------------------------------

export interface ComputedTopic {
  seed: TopicSeed;
  state: TopicState;
  priority: number;
  remainingHours: number;
  progress: number; // 0..1 readiness contribution
  readinessContribution: number; // staticWeight * progress
  nextAction: string;
}

export interface DayPlan {
  date: string; // ISO yyyy-mm-dd
  dayName: string;
  weekdayIndex: number;
  mode: StudyMode;
  availableMinutes: number;
  energy: number;
  topicId: string | null;
  topicName: string;
  section: string | null;
  tier: Tier | null;
  priority: number | null;
  suggestedMinutes: number;
  task: string;
  status: DayStatus;
  /** Resolved day mode for this date ("normal" when nothing is set). */
  dayMode: DayMode;
  noteUrl: string;
  isToday: boolean;
  fromBacklog: boolean;
}

export interface PacingInfo {
  daysRemaining: number;
  weeksRemaining: number;
  examPassed: boolean;
  plannedTotalHours: number;
  completedHours: number;
  remainingHours: number;
  requiredWeeklyHours: number;
  availableWeeklyHours: number;
  plannedWeeklyHours: number;
  paceStatus: PaceStatus;
}
