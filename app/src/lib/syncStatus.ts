// Pure presentation logic for the single Sync button, kept out of the React
// component so it can be unit-tested without a DOM.

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SyncButtonView {
  label: string;
  spinning: boolean;
  toneClass: "" | "is-success" | "is-error";
}

/** Map a sync status to the button's label, spin state, and tone class. */
export function describeSyncButton(status: SyncStatus): SyncButtonView {
  switch (status) {
    case "syncing":
      return { label: "Syncing...", spinning: true, toneClass: "" };
    case "success":
      return { label: "Synced", spinning: false, toneClass: "is-success" };
    case "error":
      return { label: "Sync failed", spinning: false, toneClass: "is-error" };
    case "idle":
    default:
      return { label: "Sync", spinning: false, toneClass: "" };
  }
}
