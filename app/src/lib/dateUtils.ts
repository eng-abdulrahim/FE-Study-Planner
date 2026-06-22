// Local-date helpers for the exam-date driven calculations.
// All parsing is done at local midnight to avoid timezone off-by-one errors.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function parseLocalDate(dateString: string): Date {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Strip a Date down to local midnight. */
function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Display an ISO date as "22 Jul 2026". */
export function formatDisplayDate(dateString: string): string {
  const d = parseLocalDate(dateString);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Whole local days from today to the exam date. */
export function getDaysRemaining(examDate: string, today: Date = new Date()): number {
  const exam = parseLocalDate(examDate).getTime();
  const now = atMidnight(today).getTime();
  return Math.round((exam - now) / 86_400_000);
}

export function isExamPassed(examDate: string, today: Date = new Date()): boolean {
  return getDaysRemaining(examDate, today) < 0;
}

export function isExamToday(examDate: string, today: Date = new Date()): boolean {
  return getDaysRemaining(examDate, today) === 0;
}

/** Weeks remaining, never below 1 (used for pacing). */
export function getWeeksRemaining(daysRemaining: number): number {
  return Math.max(daysRemaining / 7, 1);
}
