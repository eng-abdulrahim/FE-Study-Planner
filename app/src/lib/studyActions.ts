// Pure, testable study-log transforms shared by PlannerContext. Marking a day
// "done" logs a session and adds its hours to the topic; undo removes the
// matching log entries and gives the hours back. Both are idempotent/reversible.
import type { DayPlan, PlannerState, StudyLogEntry } from "../types/planner";
import { clampNumber } from "./validation";

export function clampHours(v: number): number {
  return clampNumber(v, 0, 10_000, 0);
}

export function adjustTopicHoursIn(
  state: PlannerState,
  topicId: string | null,
  deltaHours: number,
): PlannerState {
  if (!topicId) return state;
  const cur = state.topics[topicId];
  if (!cur) return state;
  return {
    ...state,
    topics: {
      ...state.topics,
      [topicId]: { ...cur, completedHours: clampHours(cur.completedHours + deltaHours) },
    },
  };
}

/** Mark a day done: log the session once (idempotent per date+topic) + add hours. */
export function markDayDoneIn(
  state: PlannerState,
  day: DayPlan,
  makeId: () => string,
): PlannerState {
  if (day.mode === "Rest") return state;
  const minutes = day.suggestedMinutes > 0 ? day.suggestedMinutes : day.availableMinutes;
  const already = state.studyLog.some((e) => e.date === day.date && e.topicId === day.topicId);
  if (already) return state; // never double-count the same day/topic
  const entry: StudyLogEntry = {
    id: makeId(),
    date: day.date,
    topicId: day.topicId,
    topicName: day.topicName,
    mode: day.mode,
    minutes,
  };
  const withLog: PlannerState = { ...state, studyLog: [...state.studyLog, entry] };
  return adjustTopicHoursIn(withLog, day.topicId, minutes / 60);
}

/** Undo a day's done: remove matching log entries and reverse their hours. */
export function undoDayDoneIn(state: PlannerState, day: DayPlan): PlannerState {
  const matches = state.studyLog.filter((e) => e.date === day.date && e.topicId === day.topicId);
  if (matches.length === 0) return state;
  let next: PlannerState = {
    ...state,
    studyLog: state.studyLog.filter((e) => !(e.date === day.date && e.topicId === day.topicId)),
  };
  for (const e of matches) next = adjustTopicHoursIn(next, e.topicId, -e.minutes / 60);
  return next;
}
