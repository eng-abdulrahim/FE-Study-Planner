// Small helpers for the debounced auto-push, kept pure/testable.

/** Default quiet period before an auto-push fires. */
export const AUTO_PUSH_DEBOUNCE_MS = 4000;

/**
 * "Dirty" means the local data changed since the last successful sync. After a
 * pull/push we set lastSyncedLocalUpdatedAt to the synced value, so this returns
 * false and auto-push cannot loop on its own state changes.
 */
export function isDirty(localUpdatedAt: string | null, lastSyncedLocalUpdatedAt: string | null): boolean {
  return (localUpdatedAt ?? null) !== (lastSyncedLocalUpdatedAt ?? null);
}

export interface Debouncer {
  schedule: (fn: () => void) => void;
  cancel: () => void;
}

/** A trailing debouncer: only the last scheduled call within `delayMs` runs. */
export function createDebouncer(delayMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule(fn: () => void) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, delayMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
