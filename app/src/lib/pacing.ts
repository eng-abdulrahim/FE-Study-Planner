// Exam-date pacing - turns the exam date into a real schedule driver,
// not just a countdown.
import type { PaceStatus, PacingInfo } from "../types/planner";
import { daysBetween, round1, todayISO } from "./util";

export interface PacingInput {
  examDate: string;
  today?: string;
  plannedTotalHours: number;
  completedHours: number;
  remainingHours: number;
  availableWeeklyHours: number;
  plannedWeeklyHours: number;
}

export function daysRemaining(examDate: string, today = todayISO()): number {
  return daysBetween(today, examDate);
}

/** RequiredWeeklyHours = RemainingHours / max(WeeksRemaining, 1). */
export function requiredWeeklyHours(
  remainingHours: number,
  examDate: string,
  today = todayISO(),
): number {
  const days = Math.max(daysRemaining(examDate, today), 0);
  const weeks = Math.max(days / 7, 1);
  return remainingHours / weeks;
}

export function paceStatusFor(
  availableWeekly: number,
  requiredWeekly: number,
  examPassed: boolean,
): PaceStatus {
  if (examPassed) return "Exam Passed";
  if (requiredWeekly <= 0) return "Ahead";
  if (availableWeekly > requiredWeekly * 1.15) return "Ahead";
  if (availableWeekly < requiredWeekly * 0.85) return "Behind";
  return "On Track";
}

export function computePacing(input: PacingInput): PacingInfo {
  const today = input.today ?? todayISO();
  const rawDays = daysRemaining(input.examDate, today);
  const examPassed = rawDays < 0;
  const days = Math.max(rawDays, 0);
  const weeks = round1(days / 7);

  const required = round1(requiredWeeklyHours(input.remainingHours, input.examDate, today));
  const available = round1(input.availableWeeklyHours);

  return {
    daysRemaining: days,
    weeksRemaining: weeks,
    examPassed,
    plannedTotalHours: round1(input.plannedTotalHours),
    completedHours: round1(input.completedHours),
    remainingHours: round1(input.remainingHours),
    requiredWeeklyHours: required,
    availableWeeklyHours: available,
    plannedWeeklyHours: round1(input.plannedWeeklyHours),
    paceStatus: paceStatusFor(available, required, examPassed),
  };
}
