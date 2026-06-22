// Local-only sync metadata + conflict decision.
//
// The repository target now lives in src/config/syncConfig.ts, so this module
// only tracks per-device sync bookkeeping. It NEVER stores the GitHub token.
// All values here are non-secret.

/** Version of the envelope we write (for future migrations). */
export const SYNC_SCHEMA_VERSION = 1;

/** App version recorded in the envelope. Keep in step with package.json. */
export const APP_VERSION = "1.0.0";

const SYNC_META_KEY = "latifah-fe-sync-meta";

export interface SyncMeta {
  deviceId: string;
  lastSyncedAt: string | null;
  lastKnownSha: string | null;
  /** The local `lastUpdatedAt` value captured at the last successful sync. */
  lastSyncedLocalUpdatedAt: string | null;
}

export type SyncDecision = "in-sync" | "push" | "pull" | "conflict";

function getStore(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultSyncMeta(): SyncMeta {
  return {
    deviceId: randomId(),
    lastSyncedAt: null,
    lastKnownSha: null,
    lastSyncedLocalUpdatedAt: null,
  };
}

/** Read metadata, healing missing fields and ensuring a stable deviceId. */
export function loadSyncMeta(): SyncMeta {
  const base = defaultSyncMeta();
  const store = getStore();
  if (!store) return base;

  let raw: Partial<SyncMeta> | null = null;
  try {
    const text = store.getItem(SYNC_META_KEY);
    raw = text ? (JSON.parse(text) as Partial<SyncMeta>) : null;
  } catch {
    raw = null;
  }
  // First run on this device: persist the base so the deviceId stays stable.
  if (!raw || typeof raw !== "object") return saveSyncMeta(base);

  const merged: SyncMeta = {
    deviceId: typeof raw.deviceId === "string" && raw.deviceId ? raw.deviceId : base.deviceId,
    lastSyncedAt: typeof raw.lastSyncedAt === "string" ? raw.lastSyncedAt : null,
    lastKnownSha: typeof raw.lastKnownSha === "string" ? raw.lastKnownSha : null,
    lastSyncedLocalUpdatedAt:
      typeof raw.lastSyncedLocalUpdatedAt === "string" ? raw.lastSyncedLocalUpdatedAt : null,
  };

  if (!raw.deviceId) saveSyncMeta(merged);
  return merged;
}

export function saveSyncMeta(meta: SyncMeta): SyncMeta {
  const store = getStore();
  if (store) {
    try {
      store.setItem(SYNC_META_KEY, JSON.stringify(meta));
    } catch {
      /* ignore quota/availability errors - sync meta is best-effort */
    }
  }
  return meta;
}

export function getOrCreateDeviceId(): string {
  return loadSyncMeta().deviceId;
}

/**
 * Decide what a sync should do, using the file `sha` for the cloud side and the
 * snapshotted `lastUpdatedAt` for the local side (no cross-device clock compare):
 *
 *   local changed only -> push
 *   cloud changed only -> pull
 *   both changed       -> conflict
 *   neither changed    -> in-sync
 */
export function decideSync(args: {
  localUpdatedAt: string | null;
  lastSyncedLocalUpdatedAt: string | null;
  remoteSha: string | null;
  lastKnownSha: string | null;
}): SyncDecision {
  const localChanged = (args.localUpdatedAt ?? null) !== (args.lastSyncedLocalUpdatedAt ?? null);
  const cloudChanged = (args.remoteSha ?? null) !== (args.lastKnownSha ?? null);

  if (localChanged && cloudChanged) return "conflict";
  if (localChanged) return "push";
  if (cloudChanged) return "pull";
  return "in-sync";
}
