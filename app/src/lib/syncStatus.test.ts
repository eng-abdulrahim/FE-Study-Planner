import { describe, expect, it } from "vitest";
import { describeSyncButton } from "./syncStatus";
import type { SyncStatus } from "./syncStatus";

describe("describeSyncButton", () => {
  it("shows 'Checking key...' and spins while validating", () => {
    const v = describeSyncButton("checking");
    expect(v.label).toBe("Checking key...");
    expect(v.spinning).toBe(true);
  });

  it("shows 'Activation required' when no key is active", () => {
    const v = describeSyncButton("needs-activation");
    expect(v.label).toBe("Activation required");
    expect(v.spinning).toBe(false);
  });

  it("shows 'Local only' when the user opted out", () => {
    const v = describeSyncButton("local-only");
    expect(v.label).toBe("Local only");
    expect(v.spinning).toBe(false);
  });

  it("shows 'Cloud sync active' when active and idle", () => {
    const v = describeSyncButton("active", "idle");
    expect(v.label).toBe("Cloud sync active");
    expect(v.spinning).toBe(false);
    expect(v.toneClass).toBe("");
  });

  it("shows 'Syncing...' and spins while active syncing", () => {
    const v = describeSyncButton("active", "syncing");
    expect(v.label).toBe("Syncing...");
    expect(v.spinning).toBe(true);
  });

  it("shows 'Synced' on active success", () => {
    const v = describeSyncButton("active", "success");
    expect(v.label).toBe("Synced");
    expect(v.toneClass).toBe("is-success");
    expect(v.spinning).toBe(false);
  });

  it("shows 'Cloud sync failed' on active error", () => {
    const v = describeSyncButton("active", "error");
    expect(v.label).toBe("Cloud sync failed");
    expect(v.toneClass).toBe("is-error");
  });

  it("only spins while syncing or checking", () => {
    const idleStates: SyncStatus[] = ["idle", "success", "error"];
    for (const s of idleStates) {
      expect(describeSyncButton("active", s).spinning).toBe(false);
    }
    expect(describeSyncButton("local-only").spinning).toBe(false);
    expect(describeSyncButton("needs-activation").spinning).toBe(false);
    expect(describeSyncButton("checking").spinning).toBe(true);
  });

  it("never exposes provider-specific wording", () => {
    const labels = [
      describeSyncButton("checking").label,
      describeSyncButton("needs-activation").label,
      describeSyncButton("local-only").label,
      describeSyncButton("active", "idle").label,
      describeSyncButton("active", "syncing").label,
      describeSyncButton("active", "success").label,
      describeSyncButton("active", "error").label,
    ].join(" ");
    expect(labels.toLowerCase()).not.toContain("github");
    expect(labels.toLowerCase()).not.toContain("token");
    expect(labels.toLowerCase()).not.toContain("repo");
  });
});
