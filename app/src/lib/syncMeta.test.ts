import { afterEach, describe, expect, it, vi } from "vitest";
import { decideSync, defaultSyncMeta, loadSyncMeta, saveSyncMeta } from "./syncMeta";

function memoryStorage() {
  const store = new Map<string, string>();
  const api = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  return { store, api };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decideSync", () => {
  it("returns in-sync when neither side changed", () => {
    expect(
      decideSync({ localUpdatedAt: "A", lastSyncedLocalUpdatedAt: "A", remoteSha: "S", lastKnownSha: "S" }),
    ).toBe("in-sync");
  });

  it("returns push when only local changed", () => {
    expect(
      decideSync({ localUpdatedAt: "B", lastSyncedLocalUpdatedAt: "A", remoteSha: "S", lastKnownSha: "S" }),
    ).toBe("push");
  });

  it("returns pull when only the cloud changed", () => {
    expect(
      decideSync({ localUpdatedAt: "A", lastSyncedLocalUpdatedAt: "A", remoteSha: "S2", lastKnownSha: "S" }),
    ).toBe("pull");
  });

  it("returns conflict when both changed", () => {
    expect(
      decideSync({ localUpdatedAt: "B", lastSyncedLocalUpdatedAt: "A", remoteSha: "S2", lastKnownSha: "S" }),
    ).toBe("conflict");
  });

  it("treats a fresh device (null baselines) loading existing cloud data as pull", () => {
    expect(
      decideSync({ localUpdatedAt: null, lastSyncedLocalUpdatedAt: null, remoteSha: "S", lastKnownSha: null }),
    ).toBe("pull");
  });
});

describe("sync meta token hygiene", () => {
  it("default meta has no token field", () => {
    const meta = defaultSyncMeta();
    expect("token" in meta).toBe(false);
    expect(JSON.stringify(meta).toLowerCase()).not.toContain("token");
    expect(JSON.stringify(meta)).not.toContain("ghp_");
  });

  it("saving meta never writes a token to localStorage", () => {
    const { store, api } = memoryStorage();
    vi.stubGlobal("localStorage", api);

    saveSyncMeta({ ...defaultSyncMeta(), lastKnownSha: "abc123", lastSyncedAt: "2026-01-01T00:00:00.000Z" });

    const stored = store.get("latifah-fe-sync-meta") ?? "";
    expect(stored).toContain('"lastKnownSha":"abc123"');
    expect(stored).not.toContain("ghp_");
    expect(stored).not.toContain("github_pat_");
    expect(stored.toLowerCase()).not.toContain("token");
  });
});

describe("loadSyncMeta", () => {
  it("keeps a stable deviceId across loads", () => {
    const { api } = memoryStorage();
    vi.stubGlobal("localStorage", api);

    const first = loadSyncMeta();
    const second = loadSyncMeta();
    expect(first.deviceId).toBeTruthy();
    expect(second.deviceId).toBe(first.deviceId);
  });
});
