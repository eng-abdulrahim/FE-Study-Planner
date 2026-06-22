import { describe, it, expect } from "vitest";
import { MOTIVATIONAL_MESSAGES, getDailyMotivationalMessage } from "./motivationalMessages";

describe("motivational messages", () => {
  it("contains exactly 30 messages", () => {
    expect(MOTIVATIONAL_MESSAGES).toHaveLength(30);
  });

  it("has 30 unique, non-empty strings", () => {
    expect(new Set(MOTIVATIONAL_MESSAGES).size).toBe(30);
    for (const message of MOTIVATIONAL_MESSAGES) {
      expect(typeof message).toBe("string");
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns a message that belongs to the list", () => {
    const message = getDailyMotivationalMessage(new Date(2026, 5, 22));
    expect(MOTIVATIONAL_MESSAGES).toContain(message);
  });

  it("returns the same message for any time within the same day", () => {
    const morning = new Date(2026, 5, 22, 7, 30, 0);
    const night = new Date(2026, 5, 22, 23, 45, 0);
    expect(getDailyMotivationalMessage(morning)).toBe(getDailyMotivationalMessage(night));
  });

  it("advances by one message on the next day", () => {
    const jan1 = new Date(2026, 0, 1); // day-of-year 0
    const jan2 = new Date(2026, 0, 2); // day-of-year 1
    expect(getDailyMotivationalMessage(jan1)).toBe(MOTIVATIONAL_MESSAGES[0]);
    expect(getDailyMotivationalMessage(jan2)).toBe(MOTIVATIONAL_MESSAGES[1]);
  });

  it("cycles back to the start after 30 days", () => {
    const jan1 = new Date(2026, 0, 1); // index 0
    const jan31 = new Date(2026, 0, 31); // day-of-year 30 -> 30 % 30 = 0
    expect(getDailyMotivationalMessage(jan31)).toBe(getDailyMotivationalMessage(jan1));
  });
});
