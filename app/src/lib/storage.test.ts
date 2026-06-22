import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { TOPICS } from "../data/topics";
import { exportJson, hydrate, importJson } from "./storage";

describe("storage round-trip", () => {
  it("persists a topic Note URL after export/import", () => {
    const state = buildInitialState();
    const id = TOPICS[0].id;
    state.topics[id] = { ...state.topics[id], noteUrl: "https://notes.example.com/fe/topic-1" };

    const json = exportJson(state);
    const result = importJson(json);

    expect(result.ok).toBe(true);
    expect(result.state?.topics[id].noteUrl).toBe("https://notes.example.com/fe/topic-1");
  });

  it("heals partial/old data and keeps all 85 topics", () => {
    const restored = hydrate({ examDate: "2026-07-31", topics: {} } as never);
    expect(Object.keys(restored.topics)).toHaveLength(TOPICS.length);
    expect(restored.dailyAvailability).toHaveLength(7);
  });

  it("rejects structurally invalid backups", () => {
    expect(importJson("not json").ok).toBe(false);
    expect(importJson(JSON.stringify({ foo: 1 })).ok).toBe(false);
  });

  it("preserves lastUpdatedAt through hydrate", () => {
    const restored = hydrate({ examDate: "2026-07-31", topics: {}, lastUpdatedAt: "2026-06-22T12:00:00.000Z" } as never);
    expect(restored.lastUpdatedAt).toBe("2026-06-22T12:00:00.000Z");
  });

  it("keeps a valid regenerate seed and sanitizes invalid ones to 0", () => {
    const seed = (v: unknown) => hydrate({ examDate: "2026-07-31", topics: {}, planSeed: v } as never).planSeed;
    expect(buildInitialState().planSeed).toBe(0); // fresh state starts at 0
    expect(seed(5)).toBe(5); // a real seed survives reload
    expect(seed(3.9)).toBe(3); // floored to an integer
    expect(seed(-2)).toBe(0); // negative -> 0
    expect(seed("nope")).toBe(0); // wrong type -> 0
    expect(seed(undefined)).toBe(0); // missing (old saves) -> 0
  });
});

describe("legacy status/confidence migration on hydrate", () => {
  const id = TOPICS[0].id;
  const migrated = (status: unknown) =>
    hydrate({ examDate: "2026-07-31", topics: { [id]: { status } } } as never).topics[id].status;

  it("migrates legacy internal status values to canonical ones", () => {
    expect(migrated("Not Started")).toBe("not-started");
    expect(migrated("Learning")).toBe("studying");
    expect(migrated("Practicing")).toBe("practicing");
    expect(migrated("Improving")).toBe("reviewing");
    expect(migrated("Strong")).toBe("reviewing");
    expect(migrated("Exam Ready")).toBe("done");
    expect(migrated("Skipped")).toBe("skipped");
  });

  it("migrates old display strings and unknowns safely", () => {
    expect(migrated("Almost there")).toBe("reviewing");
    expect(migrated("Ready")).toBe("done");
    expect(migrated("totally-unknown")).toBe("not-started");
  });

  it("keeps already-canonical status values unchanged", () => {
    expect(migrated("reviewing")).toBe("reviewing");
    expect(migrated("done")).toBe("done");
  });

  it("clamps invalid confidence values into 1..5", () => {
    const conf = (confidence: unknown) =>
      hydrate({ examDate: "2026-07-31", topics: { [id]: { confidence } } } as never).topics[id].confidence;
    expect(conf(0)).toBe(1);
    expect(conf(99)).toBe(5);
    expect(conf("nonsense")).toBe(3);
    expect(conf(4)).toBe(4);
  });
});

describe("export uses canonical status values", () => {
  it("never writes legacy status strings", () => {
    const json = exportJson(buildInitialState());
    for (const legacy of ["Not Started", "Exam Ready", "Almost there", "Improving"]) {
      expect(json).not.toContain(legacy);
    }
    expect(json).toContain("not-started");
  });
});

describe("import note-URL safety", () => {
  it("strips javascript: note URLs on import", () => {
    const state = buildInitialState();
    const id = TOPICS[0].id;
    state.topics[id] = { ...state.topics[id], noteUrl: "javascript:alert(document.cookie)" };

    const result = importJson(exportJson(state));
    expect(result.ok).toBe(true);
    expect(result.state?.topics[id].noteUrl).toBe("");
  });

  it("strips data: URLs but keeps valid http(s) URLs", () => {
    const state = buildInitialState();
    const bad = TOPICS[0].id;
    const good = TOPICS[1].id;
    state.topics[bad] = { ...state.topics[bad], noteUrl: "data:text/html,<script>1</script>" };
    state.topics[good] = { ...state.topics[good], noteUrl: "https://notes.example.com/ok" };

    const result = importJson(exportJson(state));
    expect(result.state?.topics[bad].noteUrl).toBe("");
    expect(result.state?.topics[good].noteUrl).toBe("https://notes.example.com/ok");
  });
});

describe("day overrides persistence", () => {
  it("round-trips day modes and skips through export/import", () => {
    const state = buildInitialState();
    state.dayOverrides = {
      "2026-06-22": { mode: "travel", updatedAt: "t" },
      "2026-06-23": { status: "skipped", updatedAt: "t" },
      "2026-06-24": { topicId: TOPICS[0].id, locked: true, updatedAt: "t" },
    };
    const result = importJson(exportJson(state));
    expect(result.ok).toBe(true);
    expect(result.state?.dayOverrides["2026-06-22"].mode).toBe("travel");
    expect(result.state?.dayOverrides["2026-06-23"].status).toBe("skipped");
    expect(result.state?.dayOverrides["2026-06-24"].topicId).toBe(TOPICS[0].id);
    expect(result.state?.dayOverrides["2026-06-24"].locked).toBe(true);
  });

  it("persists a topic's Done status and a reopened status round-trip", () => {
    const state = buildInitialState();
    const id = TOPICS[0].id;
    state.topics[id] = { ...state.topics[id], status: "done" };
    const done = importJson(exportJson(state));
    expect(done.state?.topics[id].status).toBe("done");

    state.topics[id] = { ...state.topics[id], status: "reviewing" };
    const reopened = importJson(exportJson(state));
    expect(reopened.state?.topics[id].status).toBe("reviewing");
  });

  it("round-trips locked, plannedMinutes and movedToToday", () => {
    const state = buildInitialState();
    state.dayOverrides = {
      "2026-06-22": {
        locked: true,
        topicId: TOPICS[0].id,
        plannedMinutes: 25,
        movedToToday: true,
        updatedAt: "t",
      },
    };
    const result = importJson(exportJson(state));
    expect(result.ok).toBe(true);
    const o = result.state?.dayOverrides["2026-06-22"];
    expect(o?.locked).toBe(true);
    expect(o?.plannedMinutes).toBe(25);
    expect(o?.movedToToday).toBe(true);
  });

  it("drops invalid / default day overrides on hydrate", () => {
    const restored = hydrate({
      examDate: "2026-07-31",
      topics: {},
      dayOverrides: {
        "not-a-date": { mode: "work", updatedAt: "t" },
        "2026-06-22": { mode: "banana", updatedAt: "t" }, // invalid mode -> pruned
        "2026-06-23": { mode: "normal", updatedAt: "t" }, // default -> pruned
        "2026-06-24": { topicId: "does-not-exist", updatedAt: "t" }, // stale id -> pruned
      },
    } as never);
    expect(restored.dayOverrides["not-a-date"]).toBeUndefined();
    expect(restored.dayOverrides["2026-06-22"]).toBeUndefined();
    expect(restored.dayOverrides["2026-06-23"]).toBeUndefined();
    expect(restored.dayOverrides["2026-06-24"]).toBeUndefined();
  });
});

describe("exported file token hygiene", () => {
  it("never contains a token (the planner state has no token field)", () => {
    const json = exportJson(buildInitialState());
    expect(json).not.toContain("ghp_");
    expect(json.toLowerCase()).not.toContain("token");
  });
});
