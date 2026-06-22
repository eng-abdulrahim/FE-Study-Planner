// Fixed GitHub sync configuration for this personal/private project.
//
// There is intentionally NO settings UI: owner, repo, branch, path, and the
// token all live here in code.
//
// ============================ SECURITY WARNING ============================
// This token is embedded in the FRONTEND bundle. Anyone who can access the
// built app (the deployed site or the JS files) can extract it.
//
// This is accepted by the user for PERSONAL / PRIVATE use only. It is NOT safe
// for a shared or public deployment.
//
// To keep the blast radius small, the token MUST stay fine-grained and scoped
// to a single repository:
//   - Repository:  eng-abdulrahim/private-data-store
//   - Contents:    Read and write
//   - Metadata:    Read-only
//
// If this token is ever exposed publicly, committed somewhere public, or no
// longer needed, REVOKE it on GitHub and generate a new one.
// =========================================================================
export const SYNC_CONFIG = {
  owner: "eng-abdulrahim",
  repo: "private-data-store",
  branch: "main",
  path: "apps/fe-study-planner/planner-state.json",

  /**
   * SECURITY WARNING:
   * This token is embedded in the frontend bundle.
   * Anyone who can access the built app can extract it.
   * This is accepted by the user for personal/private use only.
   * Token scope must remain limited to:
   * - Repository: eng-abdulrahim/private-data-store
   * - Contents: Read and write
   * - Metadata: Read-only
   */
  token: "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",
} as const;

/** The value shipped in source until the user pastes a real token. */
export const TOKEN_PLACEHOLDER = "PASTE_GITHUB_TOKEN_HERE";

/** True only when a real token has been pasted in (not the placeholder). */
export function isSyncConfigured(): boolean {
  const token: string = SYNC_CONFIG.token;
  return token.length > 0 && token !== TOKEN_PLACEHOLDER;
}
