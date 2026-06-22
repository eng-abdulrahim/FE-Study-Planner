// Activation key store - browser localStorage ONLY.
//
// SECURITY / PRIVACY (the whole point of this module):
// The activation key is entered by the user at runtime and kept solely in this
// browser's localStorage. It is deliberately NEVER read from env, embedded in
// the bundle, written into the synced file, exported, logged, or committed.
// Because the published build carries no key, the upstream provider's secret
// scanning never sees it and never auto-revokes it.
export const ACTIVATION_KEY_STORAGE_KEY = "fe-study-planner.activationKey.v1";

function getStore(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** The stored activation key, or null when none is set (local-only mode). */
export function getStoredActivationKey(): string | null {
  const store = getStore();
  if (!store) return null;
  try {
    const raw = store.getItem(ACTIVATION_KEY_STORAGE_KEY);
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

/** Persist an activation key (trimmed). A blank value clears it. */
export function setStoredActivationKey(key: string): void {
  const store = getStore();
  if (!store) return;
  const trimmed = key.trim();
  try {
    if (trimmed) store.setItem(ACTIVATION_KEY_STORAGE_KEY, trimmed);
    else store.removeItem(ACTIVATION_KEY_STORAGE_KEY);
  } catch {
    /* ignore quota/availability errors - key entry is best-effort */
  }
}

/** Remove the stored activation key (disable cloud sync on this device). */
export function clearStoredActivationKey(): void {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(ACTIVATION_KEY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** True when a non-empty activation key is stored. */
export function hasStoredActivationKey(): boolean {
  return getStoredActivationKey() !== null;
}
