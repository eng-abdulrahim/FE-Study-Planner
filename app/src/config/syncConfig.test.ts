import { describe, expect, it } from "vitest";
import { SYNC_CONFIG } from "./syncConfig";
import { serializeEnvelope } from "../lib/syncEnvelope";
import { buildInitialState } from "../data/defaults";

describe("SYNC_CONFIG", () => {
  it("targets the fixed private data repo", () => {
    expect(SYNC_CONFIG.owner).toBe("eng-abdulrahim");
    expect(SYNC_CONFIG.repo).toBe("private-data-store");
    expect(SYNC_CONFIG.branch).toBe("main");
    expect(SYNC_CONFIG.path).toBe("apps/fe-study-planner/planner-state.json");
  });

  it("carries NO token - the secret never lives in code or the bundle", () => {
    expect("token" in SYNC_CONFIG).toBe(false);
    expect(JSON.stringify(SYNC_CONFIG)).not.toMatch(/github_pat_|ghp_/);
  });

  it("never writes a token into the synced JSON envelope", () => {
    const json = serializeEnvelope(buildInitialState(), "device-1", "2026-06-22T00:00:00.000Z");
    expect(json.toLowerCase()).not.toContain("token");
    expect(json).not.toContain("github_pat_");
    expect(json).not.toContain("ghp_");
  });

  it("builds an envelope with the expected metadata shape", () => {
    const json = serializeEnvelope(buildInitialState(), "device-1", "2026-06-22T00:00:00.000Z");
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
    expect(typeof parsed.appVersion).toBe("string");
    expect(parsed.deviceId).toBe("device-1");
    expect(parsed.state).toBeTruthy();
  });
});
