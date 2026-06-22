# 05 - Final Recommendation

**Project:** Latifah FE Study Planner
**Question:** What is the simplest, safe way to sync planner progress and notes across devices, with no backend?

---

## 1. Recommendation in one paragraph

Build a **hybrid** feature: keep LocalStorage as the live offline cache, and add an **optional** "Backup & Sync" modal. Ship **Export / Import backup first** (zero risk, reuses existing `exportJson`/`importJson`). Then add **encrypted cloud sync using the GitHub REST Contents API directly from the browser**, storing a single **AES-GCM-encrypted** JSON file at **`data/latifah-planner-state.enc.json`** in a **dedicated private GitHub repo**. The GitHub token is a **fine-grained, single-repo, Contents-only** key that the **user enters manually** and that lives **in memory** (never in the bundle, never in LocalStorage). Conflicts are detected with the file's `sha` and resolved by a simple **Use This Device / Use Cloud / Export Backup First** choice. **Do not** use GitHub Actions, and **do not** store plaintext in the cloud.

---

## 2. Direct answers to the required questions

**Should we use GitHub as storage or not?**
**Yes** - for this single non-technical user and a static GitHub Pages app, GitHub is the best fit: no backend to run or pay for, reuses infrastructure the user already has, and gives free conflict detection via the file `sha`. Use **Supabase/Firebase only if** the project later needs multiple users, sharing, or real-time sync.

**Should we use GitHub Actions or the direct GitHub API?**
**Direct GitHub REST Contents API.** `workflow_dispatch` still requires a browser token (with a *broader* `actions:write` scope), is slower (seconds-to-minutes), and needs a second mechanism to read data back. It adds complexity with no security benefit.

**Should the saved file be plain JSON or encrypted JSON?**
**Encrypted JSON.** Mandatory for a public repo (and its permanent commit history); recommended even for a private repo because the data contains personal notes and note URLs. Use **AES-GCM (256-bit) + PBKDF2 (SHA-256, >=210,000 iterations)** via the native **Web Crypto API** - no library.

**What exact file path should be used?**
**`data/latifah-planner-state.enc.json`** in a private data repo (recommended name `latifah-planner-data`, branch `main`). The `.enc.json` suffix signals encrypted content.

**What UI buttons should be added?**
A single **"Backup & Sync"** button in the existing `Header` opens a modal with:
- **Export Backup**, **Import Backup** (always available, no setup).
- **Save to Cloud**, **Load from Cloud** (optional; needs passphrase + access key).
- Conflict choices: **Use This Device**, **Use Cloud**, **Export Backup First**.
No Settings page. Plain language only; technical details hidden behind a small "How this works / privacy" expander.

**What files in the React project will likely need changes?**
- **New:** `src/lib/crypto.ts`, `src/lib/githubSync.ts`, `src/lib/syncMeta.ts`, `src/state/SyncContext.tsx`, `src/components/sync/BackupSyncModal.tsx`, `src/components/sync/ConflictDialog.tsx`, plus their tests and a small stylesheet.
- **Changed:** `src/components/layout/Header.tsx` (button), `src/app/App.tsx` (wrap with `SyncProvider`), `src/state/PlannerContext.tsx` (serialize + `importState`/`lastUpdatedAt`), `src/lib/storage.ts` (reuse export/import, add `lastUpdatedAt` + download helper), `src/lib/validation.ts` (note-URL re-validation), `src/types/planner.ts` (sync types), `app/package.json`/`vite.config.ts` (expose `appVersion`), and docs (`README.md`, `docs/LOGIC.md`).
- **Dependencies added: none** (Web Crypto + `fetch` are native).

**What new tests should be added?**
- `crypto.test.ts` - encrypt/decrypt round-trip, wrong passphrase fails, tampered ciphertext fails, salt/IV vary per save.
- `githubSync.test.ts` (mocked `fetch`) - `getFile` base64 + `sha`, `404` -> null, `putFile` sends/omits `sha` correctly + `Authorization` header, status->error mapping (`401/403`, `409`, `5xx`).
- `syncMeta.test.ts` - `decideSync` returns push/pull/conflict/in-sync per the conflict table; stable `deviceId`.
- `storage.test.ts` (extend) - round-trip with notes/log; reject/strip `javascript:` note URLs on import.
- **Token-hygiene test** - after a sync cycle without the opt-in, no token in `localStorage`/`sessionStorage`.

**What are the risks?**
Token leakage (bundle/storage/XSS), public-repo/commit-history exposure if unencrypted, forgotten passphrase = unrecoverable cloud copy, conflict overwrite/data loss, and the existing **import-time XSS** via unvalidated `noteUrl`. All have concrete mitigations in `04_Security_Risks.md` (in-memory token, fine-grained single-repo scope, mandatory encryption, `sha` concurrency + explicit conflict choice, `noteUrl` re-validation).

**What is the simplest safe MVP?**
**Phase 0 - Export/Import backup** (a few buttons over the existing storage functions): immediate cross-device capability via a file, with **no secrets and no network**. Then **Phase 1 - encrypted GitHub sync** for seamless sync.

---

## 3. Why this is the right call

- **Simplest thing that is genuinely safe:** no backend, no shipped secret, native crypto, one file, zero new dependencies.
- **Beginner-friendly:** a single modal with plain-language buttons; the app is unchanged for anyone who never opens it.
- **Safe by construction:** token stays in memory and is single-repo/Contents-only; data is encrypted; pulls reuse the already-tested validation path; conflicts can't silently destroy work.
- **Incremental & reversible:** Phase 0 delivers value with near-zero risk; Phase 1 is additive and feature-flaggable; if unused, behavior matches today.
- **Right-sized:** matches one non-technical user. The heavier Supabase/Firebase path is documented for when/if scope grows.

---

## 4. Recommended decisions (summary table)

| Decision point | Recommendation |
| --- | --- |
| Storage backend | GitHub (not Supabase/Firebase for MVP) |
| Mechanism | Direct REST Contents API (not Actions) |
| Repo | Dedicated **private** `latifah-planner-data` |
| File path | `data/latifah-planner-state.enc.json` |
| Encryption | AES-GCM 256 + PBKDF2 SHA-256 >=210k (Web Crypto) |
| Token type | Fine-grained PAT, 1 repo, Contents R/W, expiring |
| Token storage | In memory (default); sessionStorage opt-in; never LocalStorage; never bundle |
| Conflict model | `sha` concurrency + Use This Device / Use Cloud / Export Backup First |
| Offline | LocalStorage remains the live cache |
| New dependencies | None |
| Build order | Phase 0 Export/Import -> Phase 1 Encrypted GitHub sync -> Phase 2 convenience |

---

## 5. Blocking questions before implementation

1. **Repo choice:** OK to use a **dedicated private** `latifah-planner-data` repo (recommended), or must data live in the existing app repo? (Public repo = encryption mandatory.)
2. **Config entry:** Should the user type `owner/repo` once in the modal (stored in local sync-meta), or do you want it baked in at build time via a non-secret config?
3. **Passphrase model:** One passphrase the user must remember (recommended), and you accept that forgetting it makes the *cloud copy* unrecoverable (local data is unaffected)?
4. **Scope of MVP:** Ship **Phase 0 (Export/Import)** first as its own release, or wait and ship Phase 0 + Phase 1 together?
5. **Token convenience:** Include the "Remember while this tab is open" (sessionStorage) option, or in-memory only for maximum safety in v1?
6. **CSP:** Do you want a `Content-Security-Policy` meta tag added (locks `connect-src` to GitHub) even though it needs testing against Vite's inline bootstrap?

Once these are answered, implementation can start at **Phase 0** per `03_Implementation_Plan.md`.
