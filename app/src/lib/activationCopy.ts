// Single source of truth for ALL user-facing cloud-sync wording.
//
// Rule: nothing here may reveal the underlying provider. No "GitHub", "repo",
// "token", "PAT", "branch", "API", file paths, etc. The user only ever sees a
// generic "activation key" / "cloud sync" experience. A unit test
// (activationCopy.test.ts) enforces this, so route every visible string through
// this module.
export const ACTIVATION_COPY = {
  // Modal
  modalTitle: "Activate Cloud Sync",
  modalDescription: "Enter your activation key to enable cloud sync on this device.",
  inputLabel: "Activation key",
  inputPlaceholder: "Enter activation key",
  activate: "Activate",
  cancel: "Cancel",
  checking: "Checking key...",
  success: "Cloud sync activated",
  show: "Show",
  hide: "Hide",
  connectedHint: "Connected on this device",

  // Status labels (header button)
  statusActive: "Cloud sync active",
  statusSyncing: "Syncing...",
  statusSynced: "Synced",
  statusActivationRequired: "Activation required",
  statusFailed: "Cloud sync failed",
  statusLocalOnly: "Local only",

  // Transient toast messages
  saving: "Saving...",
  saved: "Saved",
  synced: "Synced",

  // Menu actions
  menuActivate: "Activate cloud sync",
  menuChange: "Change activation key",
  menuRemove: "Remove activation key",
  menuSyncNow: "Sync now",

  // Errors (all generic - never name the provider)
  errEmpty: "Please enter an activation key.",
  errInvalid: "Invalid or expired activation key. Please check the key and try again.",
  errNoAccess: "This activation key does not have access to cloud sync.",
  errNetwork: "Could not verify the activation key right now. Check your connection and try again.",
  errSaveFailed: "Cloud sync could not save your latest changes.",
  errLoadFailed: "Cloud sync could not load your saved data.",
  errMissing: "Activation key required.",
  errNoLongerValid: "Your activation key is no longer valid. Please enter a new key.",
  errConflict: "Cloud sync changed during the save. Please try again.",
  errBadCloudCopy: "The cloud copy could not be read.",
  errGeneric: "Cloud sync ran into a problem. Please try again.",
} as const;

export type ActivationCopy = typeof ACTIVATION_COPY;
