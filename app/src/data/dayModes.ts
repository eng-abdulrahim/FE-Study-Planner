// Single source of truth for DAY MODES (per-date real-life constraints).
//
// A day mode is NOT a topic status. Topic status describes a topic's workflow
// state; a day mode describes a single calendar day ("Not in mood", "Family",
// "Travel", "Work") and only adjusts how that day is planned (lighter task,
// shorter session). "normal" means no special handling.
import type { DayMode } from "../types/planner";

export const DAY_MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "not-in-mood", label: "Not in mood" },
  { value: "family", label: "Family" },
  { value: "travel", label: "Travel" },
  { value: "work", label: "Work" },
] as const satisfies readonly { value: DayMode; label: string }[];

export const DAY_MODE_VALUES: DayMode[] = DAY_MODE_OPTIONS.map((o) => o.value);

const DAY_MODE_LABEL_MAP: Record<DayMode, string> = Object.fromEntries(
  DAY_MODE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DayMode, string>;

export function getDayModeLabel(mode: DayMode): string {
  return DAY_MODE_LABEL_MAP[mode] ?? DAY_MODE_LABEL_MAP.normal;
}

export function isDayMode(value: unknown): value is DayMode {
  return typeof value === "string" && (DAY_MODE_VALUES as string[]).includes(value);
}

export function normalizeDayMode(value: unknown): DayMode {
  return isDayMode(value) ? value : "normal";
}

/**
 * Per-mode planning rules. `cap` is the maximum suggested minutes (the day's
 * session is shortened to at most this, never increased). `task` is the Today /
 * weekly task text; `shortTask` and `message` drive the Today card.
 */
export interface DayModePlan {
  cap: number;
  task: string;
  shortTask: string;
  message: string;
}

export const DAY_MODE_PLAN: Record<Exclude<DayMode, "normal">, DayModePlan> = {
  "not-in-mood": {
    cap: 20,
    task: "Low-energy plan: review the key idea, then solve one short problem.",
    shortTask: "Quick review",
    message: "Keep it light today. Review the main idea and solve one short question.",
  },
  family: {
    cap: 15,
    task: "Family day: keep it light. Do a quick formula review only if you have time.",
    shortTask: "Light review",
    message: "Family day. Study only if you have a quiet window.",
  },
  travel: {
    cap: 20,
    task: "Travel plan: review notes or formulas. Keep the task short and mobile-friendly.",
    shortTask: "Mobile review",
    message: "Use travel time for formulas or notes. Avoid heavy practice.",
  },
  work: {
    cap: 30,
    task: "Work day: do a focused short session and leave deeper practice for another day.",
    shortTask: "Short focused session",
    message: "Busy work day. Do the core concept only.",
  },
};

/** Day modes whose past, unlogged days are treated softly (no harsh "missed"). */
export function isSoftMissDay(mode: DayMode): boolean {
  return mode === "family" || mode === "travel" || mode === "not-in-mood";
}

/**
 * Adjust a base session for a day mode. Returns the (reduced) suggested minutes
 * and the lighter task text. The session is never increased and never exceeds
 * the day's available minutes. `mode === "normal"` returns the base unchanged
 * with an empty task (the caller keeps its own task text).
 */
export function applyDayMode(
  baseMinutes: number,
  availableMinutes: number,
  mode: DayMode,
): { suggestedMinutes: number; task: string } {
  if (mode === "normal") return { suggestedMinutes: baseMinutes, task: "" };
  const cfg = DAY_MODE_PLAN[mode];
  const suggested = Math.max(0, Math.min(baseMinutes, cfg.cap, availableMinutes));
  return { suggestedMinutes: suggested, task: cfg.task };
}

export interface TodayModeInfo {
  label: string;
  shortTask: string;
  message: string;
}

/** Today-card description for a day mode, or null for "normal". */
export function describeTodayMode(mode: DayMode): TodayModeInfo | null {
  if (mode === "normal") return null;
  const cfg = DAY_MODE_PLAN[mode];
  return { label: getDayModeLabel(mode), shortTask: cfg.shortTask, message: cfg.message };
}
