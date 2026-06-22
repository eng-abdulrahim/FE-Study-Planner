import { describe, expect, it } from "vitest";
import { describeSyncButton } from "./syncStatus";
import type { SyncStatus } from "./syncStatus";

describe("describeSyncButton", () => {
  it("shows 'Sync' when idle", () => {
    const v = describeSyncButton("idle");
    expect(v.label).toBe("Sync");
    expect(v.spinning).toBe(false);
    expect(v.toneClass).toBe("");
  });

  it("shows 'Syncing...' and spins while syncing", () => {
    const v = describeSyncButton("syncing");
    expect(v.label).toBe("Syncing...");
    expect(v.spinning).toBe(true);
  });

  it("shows 'Synced' on success", () => {
    const v = describeSyncButton("success");
    expect(v.label).toBe("Synced");
    expect(v.toneClass).toBe("is-success");
    expect(v.spinning).toBe(false);
  });

  it("shows 'Sync failed' on error", () => {
    const v = describeSyncButton("error");
    expect(v.label).toBe("Sync failed");
    expect(v.toneClass).toBe("is-error");
  });

  it("only spins while syncing", () => {
    const others: SyncStatus[] = ["idle", "success", "error"];
    for (const s of others) {
      expect(describeSyncButton(s).spinning).toBe(false);
    }
  });
});
