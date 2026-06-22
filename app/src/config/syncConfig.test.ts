import { describe, expect, it } from "vitest";
import { SYNC_CONFIG, TOKEN_PLACEHOLDER, isSyncConfigured } from "./syncConfig";
import { serializeEnvelope } from "../lib/syncEnvelope";
import { buildInitialState } from "../data/defaults";

describe("SYNC_CONFIG", () => {
  it("targets the fixed private data repo", () => {
    expect(SYNC_CONFIG.owner).toBe("eng-abdulrahim");
    expect(SYNC_CONFIG.repo).toBe("private-data-store");
    expect(SYNC_CONFIG.branch).toBe("main");
    expect(SYNC_CONFIG.path).toBe("apps/fe-study-planner/planner-state.json");
  });

  it("has a token field as a string", () => {
    expect(typeof SYNC_CONFIG.token).toBe("string");
    expect(SYNC_CONFIG.token.length).toBeGreaterThan(0);
  });

  it("treats the placeholder as not-configured and a real token as configured", () => {
    // Widen to string: SYNC_CONFIG is `as const`, so the token is a literal type
    // and a direct === against the placeholder would be a no-overlap type error.
    const token: string = SYNC_CONFIG.token;
    expect(isSyncConfigured()).toBe(token !== TOKEN_PLACEHOLDER && token.length > 0);
  });

  it("never writes the token into the synced JSON envelope", () => {
    const json = serializeEnvelope(buildInitialState(), "device-1", "2026-06-22T00:00:00.000Z");
    expect(json).not.toContain(SYNC_CONFIG.token);
    expect(json.toLowerCase()).not.toContain("token");
    expect(json).not.toContain("ghp_");
    expect(json).not.toContain("github_pat_");
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
