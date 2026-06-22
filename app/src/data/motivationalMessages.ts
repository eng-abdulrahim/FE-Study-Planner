// Short, supportive daily notes shown on the dashboard in place of any
// "behind schedule" pacing wording. Plain text only, no emojis.
// One message is shown per calendar day and stays stable through the day.

export const MOTIVATIONAL_MESSAGES = [
  "One focused session is enough to move forward.",
  "Small progress today still counts.",
  "Keep it simple. Study one thing well.",
  "You are building momentum one topic at a time.",
  "A short review is better than skipping.",
  "Today is a good day to understand one idea.",
  "Stay steady. The plan will adjust with you.",
  "One solved problem can change your confidence.",
  "Focus on progress, not perfection.",
  "Start small and let the session grow.",
  "You do not need a perfect day to improve.",
  "Review first, then practice lightly.",
  "Every topic you touch becomes less scary.",
  "Consistency beats pressure.",
  "Take the next small step.",
  "Your preparation is growing quietly.",
  "A calm session is still a strong session.",
  "Learn one formula, solve one problem.",
  "You are closer than yesterday.",
  "Make today simple and useful.",
  "A little focus today helps tomorrow.",
  "Keep going. The schedule is here to support you.",
  "Study with patience, not panic.",
  "One clear concept is a win.",
  "You can recover the plan step by step.",
  "Do what you can today.",
  "A short session keeps the habit alive.",
  "Slow progress is still real progress.",
  "Choose one task and finish it.",
  "You are preparing with purpose.",
] as const;

/**
 * Returns one motivational message for the given calendar day.
 *
 * The message is derived from the day-of-year, so it is stable for the whole
 * day (it does not change on refresh) and cycles back to the first message
 * after every 30 days.
 */
export function getDailyMotivationalMessage(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const index = ((dayOfYear % MOTIVATIONAL_MESSAGES.length) + MOTIVATIONAL_MESSAGES.length) %
    MOTIVATIONAL_MESSAGES.length;
  return MOTIVATIONAL_MESSAGES[index];
}
