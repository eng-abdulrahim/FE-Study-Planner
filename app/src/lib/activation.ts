// Activation-key validation.
//
// Validates a key WITHOUT a destructive write: it performs a single read of the
// cloud data file. Success (file present OR not-created-yet) means the key works
// for cloud sync. Auth failures map to generic, provider-agnostic reasons so the
// UI never has to mention the underlying provider.
import { getFile, GitHubSyncError } from "./githubSync";
import type { RemoteFile, RepoTarget } from "./githubSync";
import { SYNC_CONFIG } from "../config/syncConfig";
import { ACTIVATION_COPY } from "./activationCopy";

export type ActivationFailureReason = "empty" | "invalid" | "no-access" | "network" | "unknown";

export type ActivationResult = { ok: true } | { ok: false; reason: ActivationFailureReason };

export interface ActivationDeps {
  target: RepoTarget;
  getFile: (target: RepoTarget, key: string) => Promise<RemoteFile | null>;
}

function defaultDeps(): ActivationDeps {
  return {
    target: {
      owner: SYNC_CONFIG.owner,
      repo: SYNC_CONFIG.repo,
      path: SYNC_CONFIG.path,
      branch: SYNC_CONFIG.branch,
    },
    getFile,
  };
}

/**
 * Validate an activation key by reading the cloud data file.
 * - present file or 404 (not created yet) -> ok
 * - 401 -> invalid (bad/expired key)
 * - 403 -> no-access (key cannot reach cloud sync)
 * - network/5xx -> network
 */
export async function validateActivationKey(
  key: string,
  deps: ActivationDeps = defaultDeps(),
): Promise<ActivationResult> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  try {
    // null = file not created yet, which still proves the key can read cloud sync.
    await deps.getFile(deps.target, trimmed);
    return { ok: true };
  } catch (e) {
    if (e instanceof GitHubSyncError) {
      switch (e.kind) {
        case "auth":
          return { ok: false, reason: e.status === 403 ? "no-access" : "invalid" };
        case "not-found":
          // Reachable + authorized, just nothing stored yet.
          return { ok: true };
        case "retryable":
          return { ok: false, reason: "network" };
        default:
          return { ok: false, reason: "unknown" };
      }
    }
    // Unknown/transport error - treat as a network problem, never destructive.
    return { ok: false, reason: "network" };
  }
}

/** Generic, provider-agnostic message for an activation failure. */
export function activationErrorMessage(reason: ActivationFailureReason): string {
  switch (reason) {
    case "empty":
      return ACTIVATION_COPY.errEmpty;
    case "invalid":
      return ACTIVATION_COPY.errInvalid;
    case "no-access":
      return ACTIVATION_COPY.errNoAccess;
    case "network":
      return ACTIVATION_COPY.errNetwork;
    case "unknown":
    default:
      return ACTIVATION_COPY.errGeneric;
  }
}
