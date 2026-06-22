// Fixed cloud-sync target for this personal project.
//
// There is intentionally NO access key here. The activation key is entered by
// the user at runtime and stored ONLY in this browser's localStorage (see
// lib/activationKey.ts). Keeping the secret out of the source AND out of the
// built bundle is what stops the upstream provider from detecting and
// auto-revoking it (which killed the earlier keys that were embedded via env and
// published in the deploy).
//
// owner / repo / branch / path are non-secret and safe to ship in the bundle.
export const SYNC_CONFIG = {
  owner: "eng-abdulrahim",
  repo: "private-data-store",
  branch: "main",
  path: "apps/fe-study-planner/planner-state.json",
} as const;
