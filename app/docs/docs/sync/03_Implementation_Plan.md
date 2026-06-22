# 03 - Implementation Plan

**Project:** Latifah FE Study Planner
**Scope:** Phased build of the hybrid sync feature from `02_Recommended_Architecture.md`.
**Status:** Plan only - no app code is written in this step.

---

## 1. Phasing strategy

Ship value early and keep each phase independently shippable and testable.

| Phase | Name | Ships | Risk | Depends on |
| --- | --- | --- | --- | --- |
| **0** | Backup MVP | Export / Import buttons in a "Backup & Sync" modal | Near-zero (no secrets, no network) | nothing |
| **1** | Encrypted GitHub sync | Save/Load to GitHub, encrypted, in-memory token, conflict handling | Medium (token + crypto) | Phase 0 |
| **2** | Convenience | "Remember for this tab" (sessionStorage), auto "cloud has newer changes" prompt on open | Low/Medium | Phase 1 |

A user gets cross-device capability at the end of **Phase 0** (manual file) and *seamless* sync at the end of **Phase 1**.

---

## 2. Phase 0 - Backup MVP (foundation)

**Goal:** A "Backup & Sync" modal whose Backup section works with zero setup, reusing the existing storage layer.

### New files
- `src/components/sync/BackupSyncModal.tsx` - modal shell + Backup section (Export/Import). Cloud section can render a "coming soon"/disabled stub or be hidden behind a flag until Phase 1.
- `src/components/sync/useBackupFile.ts` (optional small hook) - download/upload-file helpers.

### Changed files
- `src/components/layout/Header.tsx` - add a **"Backup & Sync"** button that opens the modal.
- `src/lib/storage.ts` - (optional) add tiny helpers `downloadBackup(state)` and keep `exportJson`/`importJson` as the core. No format change.

### Behaviour
- **Export Backup:** `exportJson(state)` -> Blob -> download `latifah-planner-backup.json`.
- **Import Backup:** file input -> read text -> `importJson(text)` -> on `ok`, `actions.importState(result.state)`; on failure, show `result.errors` in plain language.

### Tests (Phase 0)
- Extend `src/lib/storage.test.ts`: export then import returns an equivalent state (round-trip) for a state containing a note URL, edited hours, and a study-log entry.
- Import of malformed JSON / missing `examDate` / missing `topics` is rejected (already partially covered - extend).

**Exit criteria:** user can move data between two browsers via a file; all storage tests green; `npm run build` clean.

---

## 3. Phase 1 - Encrypted GitHub sync (core)

**Goal:** Save/Load the encrypted state to `data/latifah-planner-state.enc.json` in the user's private data repo, with conflict handling and an in-memory token.

### 3.1 New module: `src/lib/crypto.ts`

Pure, dependency-free Web Crypto wrappers.

```ts
// Proposed surface (illustrative - not final code)
export interface KdfParams { name: "PBKDF2"; hash: "SHA-256"; iterations: number; saltB64: string; }
export interface EncryptedBlob { cipher: "AES-GCM"; kdf: KdfParams; ivB64: string; payloadB64: string; }

export async function encryptString(plain: string, passphrase: string): Promise<EncryptedBlob>;
export async function decryptString(blob: EncryptedBlob, passphrase: string): Promise<string>;
```

- 256-bit AES-GCM key derived via PBKDF2 (SHA-256, >=210,000 iterations), random 16-byte salt + 12-byte IV per call.
- `CryptoKey` non-extractable; passphrase never stored.
- `decryptString` throws a typed error on auth-tag failure (wrong passphrase / tampered data).

### 3.2 New module: `src/lib/githubSync.ts`

Thin Contents-API client. **Token is passed in as an argument** - the module never reads/writes storage.

```ts
export interface RepoTarget { owner: string; repo: string; path: string; branch?: string; }
export interface RemoteFile { envelopeJson: string; sha: string; }

export async function getFile(t: RepoTarget, token: string): Promise<RemoteFile | null>; // null on 404
export async function putFile(t: RepoTarget, token: string, contentJson: string, sha?: string, message?: string): Promise<{ sha: string }>;
```

- `getFile`: `GET /repos/{owner}/{repo}/contents/{path}` -> decode base64 `content`, return with `sha`. `404` -> `null` (no backup yet).
- `putFile`: `PUT` with base64 content, `message`, and `sha` (omit `sha` to create). Map status codes to typed errors: `401/403` auth, `404` repo/path, `409`/422-sha conflict, `5xx`/network -> retryable.
- All calls send `Authorization: Bearer <token>` and `Accept: application/vnd.github+json`.

### 3.3 New module: `src/lib/syncMeta.ts`

```ts
export interface SyncMeta { deviceId: string; lastSyncedAt: string | null; lastKnownSha: string | null; lastSyncedLocalUpdatedAt: string | null; }
export function loadSyncMeta(): SyncMeta;          // LocalStorage key: latifah-fe-sync-meta
export function saveSyncMeta(m: SyncMeta): void;
export function getOrCreateDeviceId(): string;     // random UUID, persisted locally

export type SyncDecision = "in-sync" | "push" | "pull" | "conflict";
export function decideSync(args: {
  localUpdatedAt: string; remoteSha: string | null; meta: SyncMeta;
}): SyncDecision;                                   // implements the table in doc 02 section 7
```

### 3.4 New: `src/state/SyncContext.tsx`

- Holds: `token` (in memory), `status` ("idle"|"saving"|"loading"|"error"|"conflict"), `lastError`, `syncMeta`.
- Reads live `state` from `usePlanner()`; calls `actions.importState()` on pull.
- Actions: `setToken`, `clearToken`, `saveToCloud(passphrase)`, `loadFromCloud(passphrase)`, `resolveConflict(choice)`.
- Optional `rememberForSession` flag -> the ONLY path that writes the token to `sessionStorage`.
- Compose in `App.tsx`: `ThemeProvider > PlannerProvider > SyncProvider > AppShell`.

### 3.5 Add app version + repo config

- Expose `appVersion` from `app/package.json` (Vite `define` or a generated constant) for the envelope's `appVersion`.
- Repo target (`owner`/`repo`/`path`): the `path` is fixed (`data/latifah-planner-state.enc.json`); `owner`/`repo` are entered once by the user in the modal and stored in **local** sync meta (not secret). Default `branch` = `main`.

### 3.6 UI: cloud section + conflict dialog

- `BackupSyncModal.tsx` gains the Cloud section: passphrase field, access-key (token) field (`type="password"`), owner/repo fields (or a single "user/repo" field), "Remember while this tab is open" checkbox, **Save to Cloud** / **Load from Cloud**, and a "Last synced ..." line.
- `src/components/sync/ConflictDialog.tsx`: three buttons - **Use This Device**, **Use Cloud**, **Export Backup First**.
- A small expandable "How this works / privacy" with the technical notes.

### Changed files (Phase 1)
- `src/components/layout/Header.tsx` - button already added in Phase 0.
- `src/state/PlannerContext.tsx` - ensure a clean way to read the serializable state and that `importState` runs through validation (it already swaps state + saves; confirm `lastUpdatedAt` semantics - see note below).
- `src/lib/storage.ts` - reuse `exportJson`/`importJson`; add `lastUpdatedAt` to the saved state if not equivalent to `lastSaved` (see note).
- `src/lib/validation.ts` - **add note-URL re-validation on import/hydrate** (security hardening, doc 04).
- `src/types/planner.ts` - add `SyncMeta`, `EncryptedBlob`, envelope types.
- `app/package.json` / Vite config - expose `appVersion`.

> **Note on `lastUpdatedAt`:** the app currently stamps `lastSaved` on every save (`saveState`). Conflict detection needs a "data last changed" timestamp. Simplest: reuse `lastSaved` as `lastUpdatedAt`, since every state mutation goes through `saveState`. Confirm this during implementation; if reset/import should not count as a "change," handle explicitly.

### Tests (Phase 1)
- `src/lib/crypto.test.ts`:
  - round-trip: `decryptString(encryptString(x)) === x`.
  - wrong passphrase -> throws.
  - tampered `payloadB64`/`ivB64` -> throws (GCM auth).
  - salt and IV differ across two encryptions of the same input.
- `src/lib/githubSync.test.ts` (mock `fetch`):
  - `getFile` decodes base64 + returns `sha`; `404` -> `null`.
  - `putFile` sends `sha` on update, omits on create, sends base64 content + `Authorization` header.
  - status mapping: `401/403` -> auth error; `409`/sha-mismatch -> conflict error; `5xx` -> retryable error.
- `src/lib/syncMeta.test.ts`:
  - `decideSync` returns `push` / `pull` / `conflict` / `in-sync` for each row of the doc-02 table.
  - `getOrCreateDeviceId` is stable across calls.
- `src/lib/storage.test.ts` (extend): importing a payload with a `javascript:` note URL strips/neutralizes it (after the validation hardening lands).
- **Token-hygiene test:** after a full save/load cycle without "remember," assert `localStorage` and `sessionStorage` contain **no** value equal to the token.

**Exit criteria:** two devices stay in sync through GitHub; conflicts prompt correctly; all tests green; token never persisted by default; `npm run build` clean.

---

## 4. Phase 2 - Convenience (optional)

- **Remember token for this tab:** opt-in checkbox -> `sessionStorage`; cleared on tab close and via a "Forget key" button.
- **Auto-check on open:** when a token + passphrase are available, do a `getFile` on load; if `decideSync` returns `pull`, show a gentle banner "Cloud has newer changes - Load?" (never auto-overwrite).
- **Optional encrypted backup file:** Export can also produce `latifah-planner-backup.enc.json` using `crypto.ts`.

### Tests (Phase 2)
- sessionStorage is written **only** when the opt-in is set; "Forget key" clears it.
- auto-check shows the prompt but does not mutate state without user action.

---

## 5. Full file change inventory

### New
```
app/src/lib/crypto.ts
app/src/lib/githubSync.ts
app/src/lib/syncMeta.ts
app/src/state/SyncContext.tsx
app/src/components/sync/BackupSyncModal.tsx
app/src/components/sync/ConflictDialog.tsx
app/src/lib/crypto.test.ts
app/src/lib/githubSync.test.ts
app/src/lib/syncMeta.test.ts
app/src/styles/sync.css            (or extend an existing stylesheet)
```

### Changed
```
app/src/components/layout/Header.tsx     (add Backup & Sync button)
app/src/app/App.tsx                      (wrap with SyncProvider)
app/src/state/PlannerContext.tsx         (confirm serialize + importState/lastUpdatedAt)
app/src/lib/storage.ts                   (reuse export/import; lastUpdatedAt; download helper)
app/src/lib/validation.ts                (note-URL re-validation on import)
app/src/types/planner.ts                 (sync/envelope types)
app/src/lib/storage.test.ts              (extended cases)
app/package.json / vite.config.ts        (expose appVersion)
app/README.md / app/docs/LOGIC.md        (document sync + storage additions)
```

### Dependencies
- **None added.** Web Crypto + `fetch` are native. Keeps the current zero-runtime-dependency property. (`playwright` stays a dev-only tool.)

---

## 6. Manual QA checklist (per phase)

- [ ] Phase 0: export on browser A, import on browser B -> identical dashboard + topics.
- [ ] Phase 1: save on A, load on B -> identical; "Last synced" updates.
- [ ] Wrong passphrase on load -> clear error, local data untouched.
- [ ] Edit A and B both, then sync -> conflict dialog with three choices; each behaves correctly.
- [ ] No token entered -> Backup still fully works; cloud buttons explain what's needed.
- [ ] Refresh page -> token is gone (unless "remember for this tab" was checked).
- [ ] Offline -> app still works on LocalStorage; cloud buttons show a friendly network error.
- [ ] DevTools: confirm the token is not in `localStorage` and not in the built JS bundle.

---

## 7. Rollback / safety

- The feature is **additive and optional**; if disabled or unused, the app is unchanged.
- A feature flag (e.g. `VITE_ENABLE_CLOUD_SYNC`) can hide the cloud section while Phase 1 stabilizes, leaving Phase 0 backup live.
- Because pulls go through `importJson` and pushes are just files, the worst case is recoverable via "Export Backup First" before any overwrite.
