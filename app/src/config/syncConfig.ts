// Fixed GitHub sync configuration for this personal/private project.
//
// There is intentionally NO settings UI: owner, repo, branch, and path live here
// in code. The TOKEN is the one secret and is read at build time from a
// gitignored env var (VITE_GITHUB_SYNC_TOKEN) - it is NOT hardcoded here.
//
// ============================ SECURITY WARNING ============================
// Vite inlines `import.meta.env.VITE_*` into the FRONTEND bundle at build time.
// Anyone who can access the built app (the deployed site or its JS files) can
// extract the token. This is accepted by the user for PERSONAL / PRIVATE use
// only. It is NOT safe for a shared or public deployment.
//
// Keep the secret OUT of source control: put the real token in `app/.env.local`
// (gitignored). Do NOT paste it back into this file - a PAT committed to the
// repo gets auto-revoked by GitHub secret scanning, which is exactly what
// happened to the previous token (it started returning 401 "Bad credentials").
//
// To keep the blast radius small, the token MUST stay fine-grained and scoped
// to a single repository:
//   - Repository:  eng-abdulrahim/private-data-store
//   - Contents:    Read and write
//   - Metadata:    Read-only
//
// If this token is ever exposed publicly or no longer needed, REVOKE it on
// GitHub and generate a new one.
// =========================================================================

/** The value shipped in .env.example until a real token is provided. */
export const TOKEN_PLACEHOLDER = "PASTE_GITHUB_TOKEN_HERE";

// Read at build time from the gitignored env file. Vite only embeds VITE_*
// values present for the running mode, so it is absent in tests / when no env
// file exists, in which case sync stays disabled (local-only mode).
const TOKEN: string =
  (import.meta.env.VITE_GITHUB_SYNC_TOKEN as string | undefined)?.trim() || TOKEN_PLACEHOLDER;

export const SYNC_CONFIG = {
  owner: "eng-abdulrahim",
  repo: "private-data-store",
  branch: "main",
  path: "apps/fe-study-planner/planner-state.json",
  token: TOKEN,
} as const;

/** True only when a real token has been provided (not the placeholder). */
export function isSyncConfigured(): boolean {
  const token: string = SYNC_CONFIG.token;
  return token.length > 0 && token !== TOKEN_PLACEHOLDER;
}
