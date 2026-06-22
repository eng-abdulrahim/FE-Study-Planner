// Pure presentation logic for the header sync control, kept out of the React
// component so it can be unit-tested without a DOM. All labels are generic
// (provider-agnostic) and sourced from ACTIVATION_COPY.
import { ACTIVATION_COPY } from "./activationCopy";

/** Transient state of an in-flight sync action. */
export type SyncStatus = "idle" | "syncing" | "success" | "error";

/** High-level activation state that drives the visible label. */
export type SyncMode = "checking" | "active" | "local-only" | "needs-activation";

export interface SyncButtonView {
  label: string;
  spinning: boolean;
  toneClass: "" | "is-success" | "is-error";
}

/**
 * Map the activation mode + transient sync status to the button's label, spin
 * state, and tone. The mode wins for non-active states; while active, the label
 * reflects the live sync status.
 */
export function describeSyncButton(mode: SyncMode, status: SyncStatus = "idle"): SyncButtonView {
  switch (mode) {
    case "checking":
      return { label: ACTIVATION_COPY.checking, spinning: true, toneClass: "" };
    case "needs-activation":
      return { label: ACTIVATION_COPY.statusActivationRequired, spinning: false, toneClass: "" };
    case "local-only":
      return { label: ACTIVATION_COPY.statusLocalOnly, spinning: false, toneClass: "" };
    case "active":
    default:
      switch (status) {
        case "syncing":
          return { label: ACTIVATION_COPY.statusSyncing, spinning: true, toneClass: "" };
        case "success":
          return { label: ACTIVATION_COPY.statusSynced, spinning: false, toneClass: "is-success" };
        case "error":
          return { label: ACTIVATION_COPY.statusFailed, spinning: false, toneClass: "is-error" };
        case "idle":
        default:
          return { label: ACTIVATION_COPY.statusActive, spinning: false, toneClass: "" };
      }
  }
}
