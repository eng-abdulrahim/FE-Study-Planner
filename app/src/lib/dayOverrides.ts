// Pure, framework-agnostic transforms for per-date day overrides. Each returns
// a NEW PlannerState when something changed, or the SAME reference on a no-op so
// the PlannerContext `update()` helper does not bump `lastUpdatedAt` (and so a
// no-op never triggers a spurious auto-save / cloud push).
import type { DayMode, DayOverride, PlannerState } from "../types/planner";

function nowISO(): string {
  return new Date().toISOString();
}

/** An override matters only if it carries a non-default field. */
function meaningful(o: DayOverride): boolean {
  return (
    (o.mode !== undefined && o.mode !== "normal") ||
    o.topicId !== undefined ||
    o.status !== undefined ||
    o.locked === true ||
    o.plannedMinutes !== undefined ||
    o.movedToToday === true
  );
}

function writeOverride(state: PlannerState, date: string, next: DayOverride | null): PlannerState {
  const dayOverrides = { ...state.dayOverrides };
  if (next && meaningful(next)) dayOverrides[date] = next;
  else delete dayOverrides[date];
  return { ...state, dayOverrides };
}

export function setDayModeIn(
  state: PlannerState,
  date: string,
  mode: DayMode,
  now: string = nowISO(),
): PlannerState {
  const cur = state.dayOverrides[date];
  const curMode = cur?.mode ?? "normal";
  if (curMode === mode) return state;
  const base: DayOverride = cur ? { ...cur } : { updatedAt: now };
  if (mode === "normal") delete base.mode;
  else base.mode = mode;
  base.updatedAt = now;
  return writeOverride(state, date, base);
}

export function skipDayIn(state: PlannerState, date: string, now: string = nowISO()): PlannerState {
  const cur = state.dayOverrides[date];
  if (cur?.status === "skipped") return state;
  const base: DayOverride = cur ? { ...cur } : { updatedAt: now };
  base.status = "skipped";
  base.updatedAt = now;
  return writeOverride(state, date, base);
}

/** Remove an explicit status (e.g. un-skip) but keep any mode/topic on the day. */
export function unskipDayIn(state: PlannerState, date: string, now: string = nowISO()): PlannerState {
  const cur = state.dayOverrides[date];
  if (!cur || cur.status === undefined) return state;
  const base: DayOverride = { ...cur, updatedAt: now };
  delete base.status;
  return writeOverride(state, date, base);
}

/** Reset a day completely back to normal (drops mode, topic, status, lock). */
export function clearDayIn(state: PlannerState, date: string): PlannerState {
  if (!state.dayOverrides[date]) return state;
  return writeOverride(state, date, null);
}

export function changeDayTopicIn(
  state: PlannerState,
  date: string,
  topicId: string,
  now: string = nowISO(),
): PlannerState {
  const cur = state.dayOverrides[date];
  const id = topicId.trim();
  if (!id) {
    if (!cur || cur.topicId === undefined) return state;
    const base: DayOverride = { ...cur, updatedAt: now };
    delete base.topicId;
    delete base.locked;
    return writeOverride(state, date, base);
  }
  if (cur?.topicId === id) return state;
  const base: DayOverride = cur ? { ...cur } : { updatedAt: now };
  base.topicId = id;
  base.locked = true;
  base.updatedAt = now;
  return writeOverride(state, date, base);
}

/** Set/replace the planned minutes for a day, clamped to [5, maxMinutes]. */
export function setDayMinutesIn(
  state: PlannerState,
  date: string,
  minutes: number,
  maxMinutes: number,
  now: string = nowISO(),
): PlannerState {
  const cap = Math.max(5, Math.round(maxMinutes));
  const value = Math.min(cap, Math.max(5, Math.round(minutes)));
  const cur = state.dayOverrides[date];
  if (cur?.plannedMinutes === value) return state;
  const base: DayOverride = cur ? { ...cur } : { updatedAt: now };
  base.plannedMinutes = value;
  base.updatedAt = now;
  return writeOverride(state, date, base);
}

/** Lock a day so the scheduler keeps its topic; pins the current topic too. */
export function lockDayIn(
  state: PlannerState,
  date: string,
  topicId: string | null,
  now: string = nowISO(),
): PlannerState {
  const cur = state.dayOverrides[date];
  const alreadyLocked = cur?.locked === true;
  const pinned = cur?.topicId ?? (topicId || undefined);
  if (alreadyLocked && cur?.topicId === pinned) return state;
  const base: DayOverride = cur ? { ...cur } : { updatedAt: now };
  base.locked = true;
  if (pinned) base.topicId = pinned;
  base.updatedAt = now;
  return writeOverride(state, date, base);
}

export function unlockDayIn(state: PlannerState, date: string, now: string = nowISO()): PlannerState {
  const cur = state.dayOverrides[date];
  if (!cur || cur.locked !== true) return state;
  const base: DayOverride = { ...cur, updatedAt: now };
  delete base.locked;
  return writeOverride(state, date, base);
}

/** Pin another day's topic onto today (the "Move to Today" quick action). */
export function moveTopicToTodayIn(
  state: PlannerState,
  today: string,
  sourceDate: string,
  topicId: string,
  now: string = nowISO(),
): PlannerState {
  if (!topicId) return state;
  let next = changeDayTopicIn(state, today, topicId, now);
  if (sourceDate && sourceDate !== today) {
    const cur = next.dayOverrides[sourceDate];
    const base: DayOverride = cur ? { ...cur } : { updatedAt: now };
    if (base.movedToToday !== true) {
      base.movedToToday = true;
      base.updatedAt = now;
      next = writeOverride(next, sourceDate, base);
    }
  }
  return next;
}

/** Clear ALL overrides (including locks) for the given dates. */
export function clearWeekIn(state: PlannerState, dates: string[]): PlannerState {
  const dayOverrides = { ...state.dayOverrides };
  let changed = false;
  for (const date of dates) {
    if (dayOverrides[date]) {
      delete dayOverrides[date];
      changed = true;
    }
  }
  return changed ? { ...state, dayOverrides } : state;
}
