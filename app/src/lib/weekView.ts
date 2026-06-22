// Pure view helpers for the simplified "This week" panel. A day is considered
// completed when it has a logged session (DayStatus "done"); those are hidden
// from the active list and surfaced in a separate "Completed" section.
import type { DayPlan } from "../types/planner";

export interface WeekSplit {
  active: DayPlan[];
  completed: DayPlan[];
}

/** Split the weekly plan into active (not done) and completed (done) days. */
export function splitWeekByDone(plan: DayPlan[]): WeekSplit {
  const active: DayPlan[] = [];
  const completed: DayPlan[] = [];
  for (const day of plan) {
    if (day.status === "done") completed.push(day);
    else active.push(day);
  }
  return { active, completed };
}

/** Total planned minutes for the week (used by the live "Xh planned" label). */
export function weekPlannedMinutes(plan: DayPlan[]): number {
  return plan.reduce((sum, d) => sum + d.suggestedMinutes, 0);
}
