import { describe, it, expect } from "vitest";
import {
  CONFIDENCE_OPTIONS,
  TOPIC_STATUS_OPTIONS,
  getConfidenceLabel,
  getConfidenceShortLabel,
  getStatusLabel,
  normalizeConfidence,
  normalizeTopicStatus,
  reopenStatus,
} from "./topicOptions";

describe("confidence options", () => {
  it("maps each value to a unique, correct label", () => {
    expect(CONFIDENCE_OPTIONS.map((o) => o.label)).toEqual([
      "1 - Very weak",
      "2 - Weak",
      "3 - Okay",
      "4 - Good",
      "5 - Strong",
    ]);
  });

  it("has no duplicate labels (no repeated Weak/Strong)", () => {
    const labels = CONFIDENCE_OPTIONS.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
    const shorts = CONFIDENCE_OPTIONS.map((o) => o.shortLabel);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  it("exposes labels via helpers", () => {
    expect(getConfidenceLabel(1)).toBe("1 - Very weak");
    expect(getConfidenceLabel(5)).toBe("5 - Strong");
    expect(getConfidenceShortLabel(3)).toBe("Okay");
    expect(getConfidenceShortLabel(4)).toBe("Good");
  });
});

describe("status options", () => {
  it("maps each canonical value to the right label", () => {
    expect(getStatusLabel("not-started")).toBe("Not started");
    expect(getStatusLabel("studying")).toBe("Studying");
    expect(getStatusLabel("practicing")).toBe("Practicing");
    expect(getStatusLabel("reviewing")).toBe("Reviewing");
    expect(getStatusLabel("done")).toBe("Done");
    expect(getStatusLabel("skipped")).toBe("Skipped");
  });

  it("does not offer Strong, Ready or Almost there as a status", () => {
    const values = TOPIC_STATUS_OPTIONS.map((o) => o.value as string);
    const labels = TOPIC_STATUS_OPTIONS.map((o) => o.label);
    for (const banned of ["strong", "ready", "exam ready"]) {
      expect(values).not.toContain(banned);
    }
    for (const banned of ["Strong", "Ready", "Almost there"]) {
      expect(labels).not.toContain(banned);
    }
  });
});

describe("normalizeTopicStatus", () => {
  it("migrates legacy internal values", () => {
    expect(normalizeTopicStatus("Not Started")).toBe("not-started");
    expect(normalizeTopicStatus("Learning")).toBe("studying");
    expect(normalizeTopicStatus("Improving")).toBe("reviewing");
    expect(normalizeTopicStatus("Strong")).toBe("reviewing");
    expect(normalizeTopicStatus("Exam Ready")).toBe("done");
  });

  it("migrates old display strings", () => {
    expect(normalizeTopicStatus("Almost there")).toBe("reviewing");
    expect(normalizeTopicStatus("Ready")).toBe("done");
  });

  it("passes through canonical values and defaults unknowns", () => {
    expect(normalizeTopicStatus("reviewing")).toBe("reviewing");
    expect(normalizeTopicStatus("done")).toBe("done");
    expect(normalizeTopicStatus("")).toBe("not-started");
    expect(normalizeTopicStatus(undefined)).toBe("not-started");
    expect(normalizeTopicStatus("???")).toBe("not-started");
  });
});

describe("reopenStatus (Done -> not done)", () => {
  it("returns to reviewing when the topic has logged hours", () => {
    expect(reopenStatus(3)).toBe("reviewing");
    expect(reopenStatus(0.5)).toBe("reviewing");
  });

  it("returns to not-started when there is no progress", () => {
    expect(reopenStatus(0)).toBe("not-started");
  });
});

describe("normalizeConfidence", () => {
  it("clamps and defaults to the 1..5 range", () => {
    expect(normalizeConfidence(0)).toBe(1);
    expect(normalizeConfidence(1)).toBe(1);
    expect(normalizeConfidence(3)).toBe(3);
    expect(normalizeConfidence(5)).toBe(5);
    expect(normalizeConfidence(6)).toBe(5);
    expect(normalizeConfidence("4")).toBe(4);
    expect(normalizeConfidence("oops")).toBe(3);
  });
});
