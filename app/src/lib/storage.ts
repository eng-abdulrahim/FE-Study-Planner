// Browser persistence (LocalStorage) with a versioned, self-healing schema.
// No backend, no network: the whole planner state lives in the browser.
import type {
  DayAvailability,
  DayOverride,
  PlannerState,
  PlanTuning,
  StudyLogEntry,
  TopicState,
} from "../types/planner";
import { STORAGE_KEY, STORAGE_VERSION } from "../types/planner";
import {
  DEFAULT_AVAILABILITY,
  DEFAULT_PLAN_TUNING,
  buildInitialState,
  initialTopicState,
} from "../data/defaults";
import { TOPICS } from "../data/topics";
import { normalizeConfidence, normalizeTopicStatus } from "../data/topicOptions";
import { isDayMode } from "../data/dayModes";
import {
  clampNumber,
  isIncludeValue,
  isValidISODate,
  sanitizeNoteUrl,
  validateImportedState,
} from "./validation";

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function sanitizeTopicState(raw: unknown, fallback: TopicState): TopicState {
  if (typeof raw !== "object" || raw === null) return fallback;
  const r = raw as Record<string, unknown>;
  return {
    include: isIncludeValue(r.include) ? r.include : fallback.include,
    // Migrate any legacy status value (e.g. "Learning", "Exam Ready") to the
    // canonical set; missing/unknown values fall back to "not-started".
    status:
      r.status === undefined || r.status === null
        ? fallback.status
        : normalizeTopicStatus(r.status),
    confidence:
      r.confidence === undefined || r.confidence === null
        ? fallback.confidence
        : normalizeConfidence(r.confidence),
    boredom: clampNumber(r.boredom, 1, 5, fallback.boredom),
    quickWin: clampNumber(r.quickWin, 1, 5, fallback.quickWin),
    difficulty: clampNumber(r.difficulty, 1, 5, fallback.difficulty),
    completedHours: clampNumber(r.completedHours, 0, 10_000, fallback.completedHours),
    // Re-validate on the import/hydrate path (not only in the edit drawer):
    // strips javascript:, data:, unsupported schemes and malformed values.
    noteUrl: sanitizeNoteUrl(r.noteUrl),
  };
}

function sanitizeAvailability(raw: unknown): DayAvailability[] {
  const base = DEFAULT_AVAILABILITY.map((d) => ({ ...d }));
  if (!Array.isArray(raw)) return base;
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const idx = typeof e.weekdayIndex === "number" ? e.weekdayIndex : -1;
    if (idx < 0 || idx > 6) continue;
    base[idx] = {
      ...base[idx],
      minutes: clampNumber(e.minutes, 0, 1440, base[idx].minutes),
      energy: clampNumber(e.energy, 1, 5, base[idx].energy),
      mode:
        e.mode === "Normal" || e.mode === "Low Energy" || e.mode === "Family" || e.mode === "Rest"
          ? e.mode
          : base[idx].mode,
    };
  }
  return base;
}

function sanitizeLog(raw: unknown): StudyLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: StudyLogEntry[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.date !== "string" || !isValidISODate(e.date)) continue;
    out.push({
      id: typeof e.id === "string" ? e.id : `${e.date}-${out.length}`,
      date: e.date,
      topicId: typeof e.topicId === "string" ? e.topicId : null,
      topicName: typeof e.topicName === "string" ? e.topicName : "Study",
      mode:
        e.mode === "Normal" || e.mode === "Low Energy" || e.mode === "Family" || e.mode === "Rest"
          ? e.mode
          : "Normal",
      minutes: clampNumber(e.minutes, 0, 1440, 0),
      note: typeof e.note === "string" ? e.note : undefined,
      taskId: typeof e.taskId === "string" ? e.taskId : undefined,
    });
  }
  return out;
}

/** Per-task done/skip map, keyed by daily-plan task id (string -> done|skipped). */
function sanitizeTaskStatus(raw: unknown): Record<string, "done" | "skipped"> {
  const out: Record<string, "done" | "skipped"> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== "string" || key.length === 0) continue;
    if (value === "done" || value === "skipped") out[key] = value;
  }
  return out;
}

function sanitizePlanTuning(raw: unknown): PlanTuning {
  const base = { ...DEFAULT_PLAN_TUNING };
  if (typeof raw !== "object" || raw === null) return base;
  const r = raw as Record<string, unknown>;
  return {
    lightDay: r.lightDay === true,
    morePractice: r.morePractice === true,
    moreReview: r.moreReview === true,
    focusWeak: r.focusWeak === true,
    includeAll: r.includeAll === true,
  };
}

function sanitizeDayOverrides(raw: unknown): Record<string, DayOverride> {
  const out: Record<string, DayOverride> = {};
  if (typeof raw !== "object" || raw === null) return out;
  const topicIds = new Set(TOPICS.map((t) => t.id));
  for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidISODate(date) || typeof value !== "object" || value === null) continue;
    const v = value as Record<string, unknown>;
    const next: DayOverride = {
      updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date(0).toISOString(),
    };
    if (isDayMode(v.mode) && v.mode !== "normal") next.mode = v.mode;
    if (typeof v.topicId === "string" && topicIds.has(v.topicId)) next.topicId = v.topicId;
    if (v.status === "skipped" || v.status === "done" || v.status === "planned" || v.status === "missed")
      next.status = v.status;
    if (v.locked === true) next.locked = true;
    if (v.movedToToday === true) next.movedToToday = true;
    if (v.plannedMinutes !== undefined && v.plannedMinutes !== null) {
      const n = typeof v.plannedMinutes === "number" ? v.plannedMinutes : Number(v.plannedMinutes);
      if (Number.isFinite(n)) next.plannedMinutes = Math.min(1440, Math.max(0, Math.round(n)));
    }
    // Keep only entries that still carry a non-default field.
    if (
      next.mode !== undefined ||
      next.topicId !== undefined ||
      next.status !== undefined ||
      next.locked === true ||
      next.movedToToday === true ||
      next.plannedMinutes !== undefined
    ) {
      out[date] = next;
    }
  }
  return out;
}

/** Rebuild a complete, valid state from possibly partial/old persisted data. */
export function hydrate(raw: Partial<PlannerState> | null | undefined): PlannerState {
  const base = buildInitialState();
  if (!raw || typeof raw !== "object") return base;

  const topics: Record<string, TopicState> = {};
  for (const seed of TOPICS) {
    const fallback = initialTopicState(seed);
    topics[seed.id] = sanitizeTopicState(raw.topics?.[seed.id], fallback);
  }

  return {
    version: STORAGE_VERSION,
    examName: typeof raw.examName === "string" ? raw.examName : base.examName,
    examDate: typeof raw.examDate === "string" && isValidISODate(raw.examDate) ? raw.examDate : base.examDate,
    dailyAvailability: sanitizeAvailability(raw.dailyAvailability),
    topics,
    studyLog: sanitizeLog(raw.studyLog),
    backlog: Array.isArray(raw.backlog) ? raw.backlog : [],
    dayOverrides: sanitizeDayOverrides(raw.dayOverrides),
    taskStatus: sanitizeTaskStatus(raw.taskStatus),
    planTuning: sanitizePlanTuning(raw.planTuning),
    // Regenerate seed: a non-negative integer; anything else falls back to 0.
    planSeed:
      typeof raw.planSeed === "number" && Number.isFinite(raw.planSeed) && raw.planSeed >= 0
        ? Math.floor(raw.planSeed)
        : 0,
    ui: {
      weekStartDay: clampNumber(raw.ui?.weekStartDay, 0, 6, base.ui.weekStartDay),
      reviewWindowDays: clampNumber(raw.ui?.reviewWindowDays, 1, 60, base.ui.reviewWindowDays),
    },
    // Preserve the data-change timestamp so loading a backup/cloud copy keeps
    // the original "last updated" instant (prevents false sync conflicts).
    lastUpdatedAt: typeof raw.lastUpdatedAt === "string" ? raw.lastUpdatedAt : null,
    lastSaved: typeof raw.lastSaved === "string" ? raw.lastSaved : null,
  };
}

export function loadState(): PlannerState {
  if (!hasStorage()) return buildInitialState();
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return buildInitialState();
    return hydrate(JSON.parse(text) as Partial<PlannerState>);
  } catch {
    return buildInitialState();
  }
}

export function saveState(state: PlannerState): PlannerState {
  const stamped = { ...state, version: STORAGE_VERSION, lastSaved: new Date().toISOString() };
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    } catch {
      // storage full or blocked - keep running with in-memory state
    }
  }
  return stamped;
}

export function resetState(): PlannerState {
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  return buildInitialState();
}

export function exportJson(state: PlannerState): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(text: string): { ok: boolean; errors: string[]; state?: PlannerState } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["File is not valid JSON."] };
  }
  const result = validateImportedState(parsed);
  if (!result.ok) return result;
  return { ok: true, errors: [], state: hydrate(result.state as Partial<PlannerState>) };
}
