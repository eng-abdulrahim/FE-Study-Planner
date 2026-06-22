// Framework-agnostic cloud-sync orchestration.
//
// Fully automatic, no user action required:
//   - auto-SAVE: any local data change is pushed (debounced).
//   - auto-LOAD: on open / tab focus / a light poll, newer cloud data is pulled.
//   - conflicts (both sides changed) resolve automatically by "newest wins"
//     (compare lastUpdatedAt). There is no conflict prompt.
//
// Pulled out of React so the tricky parts (debounce, in-flight queueing, the
// hydration loop-guard, newest-wins resolution, and 409 re-fetch) are
// unit-testable with fakes and fake timers. SyncContext is a thin wrapper.
import type { PlannerState } from "../types/planner";
import type { RemoteFile, RepoTarget } from "./githubSync";
import { GitHubSyncError } from "./githubSync";
import { decideSync } from "./syncMeta";
import type { SyncMeta } from "./syncMeta";
import type { SyncStatus } from "./syncStatus";
import { createDebouncer, isDirty } from "./autoPush";

export type SyncTrigger = "manual" | "save" | "load";

export interface SyncEngineDeps {
  /** Quiet period before a debounced auto-save fires (ms). */
  debounceMs: number;
  /** Current token, or null when sync is not configured (local-only mode). */
  getToken: () => string | null;
  target: () => RepoTarget;
  getState: () => PlannerState;
  getMeta: () => SyncMeta;
  commitMeta: (patch: Partial<SyncMeta>) => void;
  serialize: (state: PlannerState, deviceId: string) => string;
  /** Parse a cloud file body into a validated state, or null if invalid. */
  parseRemote: (contentJson: string) => PlannerState | null;
  /** Apply a pulled state into the app (import/hydrate path). */
  applyRemoteState: (state: PlannerState) => void;
  getFile: (target: RepoTarget, token: string) => Promise<RemoteFile | null>;
  putFile: (
    target: RepoTarget,
    token: string,
    contentJson: string,
    sha?: string,
    message?: string,
  ) => Promise<{ sha: string }>;
  onStatus: (status: SyncStatus, message: string) => void;
  now?: () => string;
}

export interface SyncEngine {
  /** Call when local planner DATA changed (debounced auto-save). */
  onLocalChange: () => void;
  /** Manual force sync / refresh (visible status). */
  syncNow: () => Promise<void>;
  /** Background auto-load: quiet unless it actually changes data. */
  autoLoad: () => Promise<void>;
  dispose: () => void;
}

export const NOT_CONFIGURED_MESSAGE =
  "Add your GitHub token in src/config/syncConfig.ts to enable sync.";

// How many times to (re-fetch the live sha and) try a write before giving up.
// A 409 means the cloud moved between our GET and PUT; each retry reads the
// fresh sha (getFile uses cache: "no-store") and resolves again (newest-wins).
const MAX_ATTEMPTS = 3;

/** Friendly, token-free message for a failure. */
export function friendlyMessage(e: unknown): string {
  if (e instanceof GitHubSyncError) {
    switch (e.kind) {
      case "auth":
        return "Access key is missing or lacks permission.";
      case "not-found":
        return "Could not find the data repository or file.";
      case "conflict":
        return "GitHub changed during the save. Try again.";
      case "retryable":
        return "Could not reach GitHub. Check your internet.";
      default:
        return "Unexpected response from GitHub.";
    }
  }
  return "Something went wrong while syncing.";
}

function isConflictError(e: unknown): boolean {
  return e instanceof GitHubSyncError && e.kind === "conflict";
}

/** Newest data-change wins. ISO-8601 UTC strings compare lexicographically. */
function cloudIsNewer(cloud: string | null, local: string | null): boolean {
  if (cloud === null) return false; // no cloud timestamp -> keep local
  if (local === null) return true; // no local timestamp -> take cloud
  return cloud > local; // tie -> keep local (push)
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const now = deps.now ?? (() => new Date().toISOString());
  const debouncer = createDebouncer(deps.debounceMs);

  let isSaving = false; // a sync is in flight
  let queued = false; // one extra save requested while saving
  let hydrating = false; // next local-change event is a cloud import, not a user edit

  function successMessage(trigger: SyncTrigger): string {
    return trigger === "save" ? "Saved" : "Synced";
  }

  async function core(trigger: SyncTrigger): Promise<void> {
    const token = deps.getToken();
    if (!token) {
      // Local-only mode: never block the app. Only a manual click reports it.
      if (trigger === "manual") deps.onStatus("error", NOT_CONFIGURED_MESSAGE);
      return;
    }

    if (isSaving) {
      // Coalesce saves; ignore overlapping manual/background runs.
      if (trigger === "save") queued = true;
      return;
    }

    isSaving = true;
    if (trigger === "save") deps.onStatus("syncing", "Saving...");
    else if (trigger === "manual") deps.onStatus("syncing", "");
    // "load" stays quiet (no spinner) so background polls do not flicker.

    try {
      const t = deps.target();

      // A 409 on PUT means the cloud moved under us, so we re-fetch the latest
      // sha and resolve again (newest-wins), up to MAX_ATTEMPTS times.
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const remote = await deps.getFile(t, token);

        // No cloud file yet -> create it from current local state.
        if (!remote) {
          const pushed = deps.getState();
          const pushedUpdatedAt = pushed.lastUpdatedAt ?? null;
          try {
            const res = await deps.putFile(
              t,
              token,
              deps.serialize(pushed, deps.getMeta().deviceId),
              undefined,
              "Create planner data",
            );
            deps.commitMeta({
              lastKnownSha: res.sha,
              lastSyncedAt: now(),
              lastSyncedLocalUpdatedAt: pushedUpdatedAt,
            });
          } catch (e) {
            if (isConflictError(e) && attempt < MAX_ATTEMPTS) continue;
            throw e;
          }
          deps.onStatus("success", successMessage(trigger));
          return;
        }

        const raw = decideSync({
          localUpdatedAt: deps.getState().lastUpdatedAt,
          lastSyncedLocalUpdatedAt: deps.getMeta().lastSyncedLocalUpdatedAt,
          remoteSha: remote.sha,
          lastKnownSha: deps.getMeta().lastKnownSha,
        });

        let decision: "in-sync" | "push" | "pull";
        if (raw === "conflict") {
          // Auto-resolve: keep whichever side was edited most recently.
          const parsed = deps.parseRemote(remote.contentJson);
          decision = cloudIsNewer(parsed?.lastUpdatedAt ?? null, deps.getState().lastUpdatedAt ?? null)
            ? "pull"
            : "push";
        } else {
          decision = raw;
        }

        if (decision === "push") {
          // Capture what we push: edits made DURING the PUT stay dirty so the
          // queued follow-up re-pushes them (no silent data loss).
          const pushed = deps.getState();
          const pushedUpdatedAt = pushed.lastUpdatedAt ?? null;
          try {
            const res = await deps.putFile(
              t,
              token,
              deps.serialize(pushed, deps.getMeta().deviceId),
              remote.sha,
              "Update planner data",
            );
            deps.commitMeta({
              lastKnownSha: res.sha,
              lastSyncedAt: now(),
              lastSyncedLocalUpdatedAt: pushedUpdatedAt,
            });
          } catch (e) {
            if (isConflictError(e) && attempt < MAX_ATTEMPTS) continue;
            throw e;
          }
          deps.onStatus("success", successMessage(trigger));
          return;
        }

        if (decision === "pull") {
          const parsed = deps.parseRemote(remote.contentJson);
          if (!parsed) {
            if (trigger === "manual") deps.onStatus("error", "The saved file on GitHub is not a valid backup.");
            else if (trigger === "save") deps.onStatus("error", "Sync failed");
            return;
          }
          // Guard the auto-save loop: importState below fires a local-change
          // event that is NOT a user edit, so swallow exactly one.
          const willChange =
            (parsed.lastUpdatedAt ?? null) !== (deps.getState().lastUpdatedAt ?? null);
          if (willChange) hydrating = true;
          deps.applyRemoteState(parsed);
          deps.commitMeta({
            lastKnownSha: remote.sha,
            lastSyncedAt: now(),
            lastSyncedLocalUpdatedAt: parsed.lastUpdatedAt ?? null,
          });
          deps.onStatus("success", "Synced");
          return;
        }

        // in-sync: nothing to write; a background load stays silent.
        deps.commitMeta({ lastKnownSha: remote.sha, lastSyncedAt: now() });
        if (trigger === "load") deps.onStatus("idle", "");
        else deps.onStatus("success", successMessage(trigger));
        return;
      }

      // Exhausted attempts (repeated 409): report, but never for a background load.
      if (trigger === "manual") deps.onStatus("error", "GitHub changed during the save. Try again.");
      else if (trigger === "save") deps.onStatus("error", "Sync failed");
    } catch (e) {
      if (trigger === "manual") deps.onStatus("error", friendlyMessage(e));
      else if (trigger === "save") deps.onStatus("error", "Sync failed");
      // background load errors stay quiet to avoid noise
    } finally {
      isSaving = false;
      if (queued) {
        queued = false;
        if (deps.getToken() && isDirty(deps.getState().lastUpdatedAt, deps.getMeta().lastSyncedLocalUpdatedAt)) {
          void core("save");
        }
      }
    }
  }

  function onLocalChange(): void {
    // Swallow the change event caused by a cloud import.
    if (hydrating) {
      hydrating = false;
      return;
    }
    if (!deps.getToken()) return; // local-only mode
    if (!isDirty(deps.getState().lastUpdatedAt, deps.getMeta().lastSyncedLocalUpdatedAt)) return;
    debouncer.schedule(() => void core("save"));
  }

  return {
    onLocalChange,
    syncNow: () => core("manual"),
    autoLoad: () => core("load"),
    dispose: () => debouncer.cancel(),
  };
}
