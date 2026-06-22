import { afterEach, describe, expect, it, vi } from "vitest";
import { NOT_CONFIGURED_MESSAGE, createSyncEngine } from "./syncEngine";
import { GitHubSyncError } from "./githubSync";
import type { RemoteFile, RepoTarget } from "./githubSync";
import { buildInitialState } from "../data/defaults";
import type { PlannerState } from "../types/planner";
import type { SyncMeta } from "./syncMeta";

const DEBOUNCE = 4000;

function baseState(lastUpdatedAt: string | null): PlannerState {
  return { ...buildInitialState(), lastUpdatedAt };
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

interface Opts {
  token?: string | null;
  localUpdatedAt?: string | null;
  lastSyncedLocalUpdatedAt?: string | null;
  lastKnownSha?: string | null;
  cloud?: RemoteFile | null;
  remoteState?: PlannerState | null;
  putFile?: (
    t: RepoTarget,
    token: string,
    contentJson: string,
    sha?: string,
    message?: string,
  ) => Promise<{ sha: string }>;
}

function makeEngine(opts: Opts = {}) {
  const token = opts.token === undefined ? "tok" : opts.token;
  const state = baseState(opts.localUpdatedAt ?? null);
  const meta: SyncMeta = {
    deviceId: "dev",
    lastSyncedAt: null,
    lastKnownSha: opts.lastKnownSha ?? null,
    lastSyncedLocalUpdatedAt: opts.lastSyncedLocalUpdatedAt ?? null,
  };
  let cloud: RemoteFile | null = opts.cloud ?? null;
  const statuses: { status: string; message: string }[] = [];
  const applied: PlannerState[] = [];

  const getFile = vi.fn(async (_t: RepoTarget, _token: string) => cloud);
  let putCount = 0;
  const defaultPut = async (
    _t: RepoTarget,
    _token: string,
    contentJson: string,
    _sha?: string,
    _message?: string,
  ) => {
    putCount++;
    const sha = `sha-${putCount}`;
    cloud = { sha, contentJson };
    return { sha };
  };
  const putFile = vi.fn(opts.putFile ?? defaultPut);

  const engine = createSyncEngine({
    debounceMs: DEBOUNCE,
    getToken: () => token,
    target: () => ({ owner: "o", repo: "r", path: "p", branch: "main" }),
    getState: () => state,
    getMeta: () => meta,
    commitMeta: (patch) => Object.assign(meta, patch),
    serialize: (s, deviceId) => JSON.stringify({ deviceId, state: s }),
    parseRemote: () => opts.remoteState ?? baseState("cloud-T"),
    applyRemoteState: (s) => {
      applied.push(s);
      state.lastUpdatedAt = s.lastUpdatedAt ?? null;
    },
    getFile,
    putFile,
    onStatus: (status, message) => statuses.push({ status, message }),
    now: () => "NOW",
  });

  return {
    engine,
    state,
    meta,
    statuses,
    applied,
    getFile,
    putFile,
    getCloud: () => cloud,
    last: () => statuses[statuses.length - 1],
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("auto-save (onLocalChange + debounce)", () => {
  it("schedules a single debounced push after a planner change", async () => {
    vi.useFakeTimers();
    const h = makeEngine({
      localUpdatedAt: "T2",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S",
      cloud: { sha: "S", contentJson: "{}" },
    });

    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE - 1);
    expect(h.putFile).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(h.putFile).toHaveBeenCalledTimes(1);
    expect(h.last()).toEqual({ status: "success", message: "Saved" });
  });

  it("coalesces multiple rapid changes into one save", async () => {
    vi.useFakeTimers();
    const h = makeEngine({
      localUpdatedAt: "T2",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S",
      cloud: { sha: "S", contentJson: "{}" },
    });

    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(1000);
    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(1000);
    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();

    expect(h.putFile).toHaveBeenCalledTimes(1);
  });

  it("reports syncing 'Saving...' then success 'Saved'", async () => {
    vi.useFakeTimers();
    const h = makeEngine({
      localUpdatedAt: "T2",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S",
      cloud: { sha: "S", contentJson: "{}" },
    });

    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();

    expect(h.statuses[0]).toEqual({ status: "syncing", message: "Saving..." });
    expect(h.last()).toEqual({ status: "success", message: "Saved" });
  });

  it("surfaces a non-blocking error on failure and keeps working", async () => {
    vi.useFakeTimers();
    const h = makeEngine({
      localUpdatedAt: "T2",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S",
      cloud: { sha: "S", contentJson: "{}" },
      putFile: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue({ sha: "S2" }),
    });

    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(h.last()).toEqual({ status: "error", message: "Sync failed" });

    // Still dirty, engine not broken: the next change saves successfully.
    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(h.last()).toEqual({ status: "success", message: "Saved" });
  });

  it("does NOT auto-save when not configured (local-only)", async () => {
    vi.useFakeTimers();
    const h = makeEngine({ token: null, localUpdatedAt: "T2" });

    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();

    expect(h.getFile).not.toHaveBeenCalled();
    expect(h.putFile).not.toHaveBeenCalled();
  });
});

describe("hydration loop guard", () => {
  it("a cloud pull does not trigger a follow-up auto-push", async () => {
    vi.useFakeTimers();
    const h = makeEngine({
      localUpdatedAt: "T1",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S1",
      cloud: { sha: "S2", contentJson: "{}" },
      remoteState: baseState("cloud-T"),
    });

    await h.engine.syncNow(); // pulls
    await flush();
    expect(h.applied).toHaveLength(1);
    expect(h.putFile).not.toHaveBeenCalled();

    // The import fired a local-change event - it must be swallowed.
    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(h.putFile).not.toHaveBeenCalled();

    // A genuine later edit resumes normal auto-save.
    h.state.lastUpdatedAt = "T-user";
    h.engine.onLocalChange();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(h.putFile).toHaveBeenCalledTimes(1);
  });
});

describe("in-flight queue", () => {
  it("queues one save for an edit made during a save, re-pushing the newer data", async () => {
    // Real timers: we control the first PUT's resolution manually. debounce 0
    // so onLocalChange (a real edit) reaches the engine on the next tick.
    const state = baseState("T2");
    const meta: SyncMeta = {
      deviceId: "dev",
      lastSyncedAt: null,
      lastKnownSha: "S",
      lastSyncedLocalUpdatedAt: "T1",
    };
    let cloud: RemoteFile = { sha: "S", contentJson: "{}" };

    let resolvePut1!: (v: { sha: string }) => void;
    const put1 = new Promise<{ sha: string }>((r) => {
      resolvePut1 = r;
    });
    let putCount = 0;
    const putFile = vi.fn(
      async (_t: RepoTarget, _token: string, _content: string, _sha?: string) => {
        putCount++;
        if (putCount === 1) return put1;
        const sha = `S-after-${putCount}`;
        cloud = { sha, contentJson: "{}" };
        return { sha };
      },
    );

    const engine = createSyncEngine({
      debounceMs: 0,
      getToken: () => "tok",
      target: () => ({ owner: "o", repo: "r", path: "p", branch: "main" }),
      getState: () => state,
      getMeta: () => meta,
      commitMeta: (patch) => Object.assign(meta, patch),
      serialize: (s, deviceId) => JSON.stringify({ deviceId, state: s }),
      parseRemote: () => baseState("cloud-T"),
      applyRemoteState: () => {},
      getFile: vi.fn(async () => cloud),
      putFile,
      onStatus: () => {},
      now: () => "NOW",
    });

    const tick = () => new Promise((r) => setTimeout(r, 0));

    engine.onLocalChange(); // first edit -> debounced save reaches the pending PUT
    await tick();
    expect(putFile).toHaveBeenCalledTimes(1);

    // User edits again while the save is in flight: it must be coalesced.
    state.lastUpdatedAt = "T3";
    engine.onLocalChange();
    await tick();
    expect(putFile).toHaveBeenCalledTimes(1); // still only the first (queued)

    // Finish the first PUT -> the queued save chains and pushes the newer data.
    cloud = { sha: "S2", contentJson: "{}" };
    resolvePut1({ sha: "S2" });
    await tick();
    await tick();

    expect(putFile).toHaveBeenCalledTimes(2);
    expect(meta.lastSyncedLocalUpdatedAt).toBe("T3");
  });
});

describe("conflict auto-resolution (newest wins, no user action)", () => {
  it("pulls when both sides changed but the cloud was edited more recently", async () => {
    const h = makeEngine({
      localUpdatedAt: "T2",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S1",
      cloud: { sha: "S2", contentJson: "{}" },
      remoteState: baseState("T9"), // cloud newer than local T2
    });

    await h.engine.syncNow();

    expect(h.applied).toHaveLength(1); // cloud loaded automatically
    expect(h.putFile).not.toHaveBeenCalled();
    expect(h.last()).toEqual({ status: "success", message: "Synced" });
  });

  it("pushes when both sides changed but this device was edited more recently", async () => {
    const h = makeEngine({
      localUpdatedAt: "T9",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S1",
      cloud: { sha: "S2", contentJson: "{}" },
      remoteState: baseState("T2"), // cloud older than local T9
    });

    await h.engine.syncNow();

    expect(h.putFile).toHaveBeenCalledTimes(1); // local overwrites cloud
    expect(h.applied).toHaveLength(0);
    expect(h.last()).toEqual({ status: "success", message: "Synced" });
  });

  it("auto-resolves a 409 on push by re-fetching and retrying (no manual step)", async () => {
    let n = 0;
    const h = makeEngine({
      localUpdatedAt: "T9",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S",
      cloud: { sha: "S", contentJson: "{}" },
      putFile: vi.fn(async (_t: RepoTarget, _tok: string, _c: string, _sha?: string) => {
        n++;
        if (n === 1) throw new GitHubSyncError("conflict", "409", 409);
        return { sha: "S2" };
      }),
    });

    await h.engine.syncNow();

    expect(h.getFile).toHaveBeenCalledTimes(2); // re-fetched after the 409
    expect(h.putFile).toHaveBeenCalledTimes(2); // retried, then succeeded
    expect(h.last()).toEqual({ status: "success", message: "Synced" });
  });
});

describe("manual Sync", () => {
  it("creates the cloud file when it does not exist (PUT without sha)", async () => {
    const h = makeEngine({ localUpdatedAt: "T1", cloud: null });

    await h.engine.syncNow();

    expect(h.putFile).toHaveBeenCalledTimes(1);
    expect(h.putFile.mock.calls[0][3]).toBeUndefined(); // no sha => create
    expect(h.last()).toEqual({ status: "success", message: "Synced" });
  });

  it("pushes when local is newer", async () => {
    const h = makeEngine({
      localUpdatedAt: "T2",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S",
      cloud: { sha: "S", contentJson: "{}" },
    });

    await h.engine.syncNow();

    expect(h.putFile).toHaveBeenCalledTimes(1);
    expect(h.putFile.mock.calls[0][3]).toBe("S"); // updates with sha
    expect(h.last()).toEqual({ status: "success", message: "Synced" });
  });

  it("pulls when the cloud is newer", async () => {
    const h = makeEngine({
      localUpdatedAt: "T1",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S1",
      cloud: { sha: "S2", contentJson: "{}" },
      remoteState: baseState("cloud-T"),
    });

    await h.engine.syncNow();

    expect(h.applied).toHaveLength(1);
    expect(h.putFile).not.toHaveBeenCalled();
    expect(h.last()).toEqual({ status: "success", message: "Synced" });
  });

  it("reports not-configured on a manual click without a token", async () => {
    const h = makeEngine({ token: null, localUpdatedAt: "T2" });

    await h.engine.syncNow();

    expect(h.getFile).not.toHaveBeenCalled();
    expect(h.last()).toEqual({ status: "error", message: NOT_CONFIGURED_MESSAGE });
  });
});

describe("auto-load (background, no user action)", () => {
  it("pulls newer cloud data quietly, then shows Synced", async () => {
    const h = makeEngine({
      localUpdatedAt: "T1",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S1",
      cloud: { sha: "S2", contentJson: "{}" },
      remoteState: baseState("cloud-T"),
    });

    await h.engine.autoLoad();

    expect(h.applied).toHaveLength(1);
    // Quiet: a background load never shows the spinner.
    expect(h.statuses.some((s) => s.status === "syncing")).toBe(false);
    expect(h.last()).toEqual({ status: "success", message: "Synced" });
  });

  it("stays silent when already in sync (no spinner, no success toast, no put)", async () => {
    const h = makeEngine({
      localUpdatedAt: "T1",
      lastSyncedLocalUpdatedAt: "T1",
      lastKnownSha: "S",
      cloud: { sha: "S", contentJson: "{}" },
    });

    await h.engine.autoLoad();

    expect(h.putFile).not.toHaveBeenCalled();
    expect(h.applied).toHaveLength(0);
    expect(
      h.statuses.every((s) => s.status !== "syncing" && s.status !== "success"),
    ).toBe(true);
  });

  it("does nothing (and reports nothing) without a token", async () => {
    const h = makeEngine({ token: null, localUpdatedAt: "T1" });

    await h.engine.autoLoad();

    expect(h.getFile).not.toHaveBeenCalled();
    expect(h.statuses).toHaveLength(0);
  });
});
