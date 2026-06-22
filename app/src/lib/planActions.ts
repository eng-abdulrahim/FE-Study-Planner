// Pure, testable transforms for the multi-task daily plan: marking a task done,
// skipping it, or resetting it. A topic-bound "done" also writes a studyLog
// entry (tagged with the task id), adds hours AND sets the topic's canonical
// status to "done" - so the weekly plan, the Topics table Done column, readiness,
// charts and "this week" all read the SAME source of truth (topic.status). That
// keeps "Done" consistent everywhere: marking a weekly block done shows the topic
// as Done in the table, and Undo reopens it. Reset/undo reverses exactly that.
// Each returns the SAME reference on a no-op so PlannerContext.update() never
// bumps lastUpdatedAt for nothing.
import type {
  DailyStudyTask,
  PlannerState,
  PlanTuning,
  StudyLogEntry,
  TopicStatus,
} from "../types/planner";
import { DEFAULT_PLAN_TUNING } from "../data/defaults";
import { reopenStatus } from "../data/topicOptions";
import { adjustTopicHoursIn } from "./studyActions";

function tuningEquals(a: PlanTuning, b: PlanTuning): boolean {
  return (
    a.lightDay === b.lightDay &&
    a.morePractice === b.morePractice &&
    a.moreReview === b.moreReview &&
    a.focusWeak === b.focusWeak &&
    a.includeAll === b.includeAll
  );
}

/** The topic id encoded at the tail of a daily task id (`date|type|topicId`). */
function topicIdOfTaskKey(key: string): string {
  return key.slice(key.lastIndexOf("|") + 1);
}

/** True if some OTHER daily task for this topic is still marked done. */
function hasOtherDoneTopicTask(
  taskStatus: Record<string, "done" | "skipped">,
  topicId: string,
  excludeId: string,
): boolean {
  for (const [id, st] of Object.entries(taskStatus)) {
    if (id === excludeId || st !== "done") continue;
    if (topicIdOfTaskKey(id) === topicId) return true;
  }
  return false;
}

/** Set a topic's canonical status (no-op if missing or unchanged). */
function setTopicStatusIn(state: PlannerState, topicId: string, status: TopicStatus): PlannerState {
  const cur = state.topics[topicId];
  if (!cur || cur.status === status) return state;
  return { ...state, topics: { ...state.topics, [topicId]: { ...cur, status } } };
}

/**
 * Reopen a topic from Done back into planning eligibility, deriving the new
 * status from its remaining hours (reviewing if it has progress, else
 * not-started) - exactly what the Topics table Done toggle uses. Only changes
 * the status when the topic is currently "done"; study log + hours are kept.
 */
function reopenTopicStatusIn(state: PlannerState, topicId: string): PlannerState {
  const cur = state.topics[topicId];
  if (!cur || cur.status !== "done") return state;
  return setTopicStatusIn(state, topicId, reopenStatus(cur.completedHours));
}

/** Remove a task's studyLog entry (by taskId) and reverse its hours. */
function removeTaskLog(state: PlannerState, taskId: string): PlannerState {
  const matches = state.studyLog.filter((e) => e.taskId === taskId);
  if (matches.length === 0) return state;
  let next: PlannerState = { ...state, studyLog: state.studyLog.filter((e) => e.taskId !== taskId) };
  for (const e of matches) next = adjustTopicHoursIn(next, e.topicId, -e.minutes / 60);
  return next;
}

/** Mark a daily task done: record status, and (for topic tasks) log + add hours
 *  + flip the topic's canonical status to "done" so the Topics table stays in
 *  sync. Idempotent: a repeat call never double-logs or double-counts hours. */
export function setTaskDoneIn(
  state: PlannerState,
  date: string,
  task: DailyStudyTask,
  makeId: () => string,
): PlannerState {
  const alreadyDone = state.taskStatus[task.id] === "done";
  const hasLog = state.studyLog.some((e) => e.taskId === task.id);
  if (alreadyDone && (hasLog || !task.topicId)) {
    // Already recorded; just make sure the canonical topic status agrees (covers
    // data marked done before this unification, or a topic reopened elsewhere).
    return task.topicId ? setTopicStatusIn(state, task.topicId, "done") : state;
  }

  let next: PlannerState = { ...state, taskStatus: { ...state.taskStatus, [task.id]: "done" } };

  if (task.topicId && !hasLog) {
    const entry: StudyLogEntry = {
      id: makeId(),
      date,
      topicId: task.topicId,
      topicName: task.title,
      mode: "Normal",
      minutes: Math.max(0, Math.round(task.plannedMinutes)),
      taskId: task.id,
    };
    next = { ...next, studyLog: [...next.studyLog, entry] };
    next = adjustTopicHoursIn(next, task.topicId, entry.minutes / 60);
  }
  // Canonical "topic done" lives on the topic status (single source of truth).
  if (task.topicId) next = setTopicStatusIn(next, task.topicId, "done");
  return next;
}

/** Skip a task (no hours). If it was done, reverse the logged hours first and
 *  reopen the topic (unless another block keeps it done). */
export function skipTaskIn(state: PlannerState, task: DailyStudyTask): PlannerState {
  if (state.taskStatus[task.id] === "skipped") return state;
  const wasDone = state.taskStatus[task.id] === "done";
  const cleared = wasDone ? removeTaskLog(state, task.id) : state;
  let next: PlannerState = { ...cleared, taskStatus: { ...cleared.taskStatus, [task.id]: "skipped" } };
  if (wasDone && task.topicId && !hasOtherDoneTopicTask(next.taskStatus, task.topicId, task.id)) {
    next = reopenTopicStatusIn(next, task.topicId);
  }
  return next;
}

/** Reset a task back to planned (undo done or skip). Reverses hours if it was
 *  done and reopens the topic (unless another block keeps it done). */
export function resetTaskIn(state: PlannerState, task: DailyStudyTask): PlannerState {
  const status = state.taskStatus[task.id];
  const hasLog = state.studyLog.some((e) => e.taskId === task.id);
  if (!status && !hasLog) return state;
  // A logged topic task (or one explicitly flagged "done") was a completion.
  const wasDone = status === "done" || (hasLog && status !== "skipped");

  let next: PlannerState = hasLog ? removeTaskLog(state, task.id) : state;
  if (next.taskStatus[task.id]) {
    const taskStatus = { ...next.taskStatus };
    delete taskStatus[task.id];
    next = { ...next, taskStatus };
  }
  if (wasDone && task.topicId && !hasOtherDoneTopicTask(next.taskStatus, task.topicId, task.id)) {
    next = reopenTopicStatusIn(next, task.topicId);
  }
  return next === state ? state : next;
}

/**
 * Clear any weekly "done" markers for a topic (keep "skipped" ones). Study log +
 * completed hours are intentionally preserved - reopening a topic is not the same
 * as undoing each session. Returns the same reference on a no-op.
 */
export function clearTopicDoneTasksIn(state: PlannerState, topicId: string): PlannerState {
  let taskStatus = state.taskStatus;
  let cleared = false;
  for (const [id, st] of Object.entries(state.taskStatus)) {
    if (st === "done" && topicIdOfTaskKey(id) === topicId) {
      if (!cleared) {
        taskStatus = { ...state.taskStatus };
        cleared = true;
      }
      delete taskStatus[id];
    }
  }
  return cleared ? { ...state, taskStatus } : state;
}

/**
 * Reopen a topic from the Topics table (Done toggle off). Clears any weekly
 * "done" markers for the topic so no daily block keeps showing Done while the
 * topic is reopened, then derives the topic status from its remaining hours.
 * Returns the same reference on a no-op.
 */
export function reopenTopicIn(state: PlannerState, topicId: string): PlannerState {
  const cur = state.topics[topicId];
  if (!cur) return state;
  const next = clearTopicDoneTasksIn(state, topicId);
  return setTopicStatusIn(next, topicId, reopenStatus(cur.completedHours));
}

/**
 * Mark every block in a day's plan done in one shot (the Today card's single
 * primary action). Already-done blocks are left untouched, so this is safe to
 * call when some blocks were finished individually. Returns the same reference
 * when nothing changes.
 */
export function setDayDoneIn(
  state: PlannerState,
  date: string,
  tasks: readonly DailyStudyTask[],
  makeId: () => string,
): PlannerState {
  return tasks.reduce((acc, task) => setTaskDoneIn(acc, date, task, makeId), state);
}

/** Reverse a whole-day Done: reset every block back to planned (undo + hours). */
export function resetDayDoneIn(state: PlannerState, tasks: readonly DailyStudyTask[]): PlannerState {
  return tasks.reduce((acc, task) => resetTaskIn(acc, task), state);
}

/** Patch the plan-shaping nudges (Light day, More practice, ...). */
export function setPlanTuningIn(state: PlannerState, patch: Partial<PlanTuning>): PlannerState {
  const next = { ...state.planTuning, ...patch };
  if (tuningEquals(next, state.planTuning)) return state;
  return { ...state, planTuning: next };
}

/** Turn every nudge off. */
export function resetPlanTuningIn(state: PlannerState): PlannerState {
  if (tuningEquals(state.planTuning, DEFAULT_PLAN_TUNING)) return state;
  return { ...state, planTuning: { ...DEFAULT_PLAN_TUNING } };
}

/**
 * Regenerate the study plan. The engine is pure/deterministic, so "regenerate"
 * bumps a monotonic seed that the engine folds into its topic rotation: the
 * auto-picked review / practice topics reshuffle while done items, locked days,
 * day modes, skipped days and every other manual override are preserved (this
 * touches nothing but the seed). Bumping the seed is ALWAYS a real change, so
 * Regenerate reliably re-renders, saves to LocalStorage and marks the cloud
 * dirty - it can never silently no-op. Use `clearWeekIn` to reset manual edits.
 */
export function regeneratePlanIn(state: PlannerState): PlannerState {
  const cur = Number.isFinite(state.planSeed) ? Math.max(0, Math.floor(state.planSeed)) : 0;
  return { ...state, planSeed: cur + 1 };
}
