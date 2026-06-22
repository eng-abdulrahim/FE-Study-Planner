# 02 - Recommended Architecture

**Project:** Latifah FE Study Planner
**Decision in one line:** Hybrid - LocalStorage stays the live cache; an optional, encrypted GitHub Contents-API sync layer is added on top, with manual token entry kept in memory and an Export/Import fallback.

---

## 1. High-level design

```
+---------------------------------------------------------------+
|                        Browser (GitHub Pages)                 |
|                                                               |
|  PlannerContext (live state)  <----- source of truth          |
|        |                                                      |
|        v                                                      |
|  storage.ts (LocalStorage: latifah-fe-planner-v1)  <-- cache  |
|        |                                                      |
|        |  serialize (exportJson)        importState           |
|        v                                ^                     |
|  +---------------------- Sync layer (NEW) -----------------+  |
|  |  crypto.ts     encrypt/decrypt (AES-GCM + PBKDF2)       |  |
|  |  githubSync.ts GET/PUT Contents API (token in memory)   |  |
|  |  syncMeta.ts   deviceId, lastSyncedAt, lastKnownSha,    |  |
|  |                conflict detection                       |  |
|  +--------------------------------------------------------+  |
|        |  (only the encrypted payload + metadata leave)      |
+--------|------------------------------------------------------+
         v   HTTPS, user token (Authorization header)
+---------------------------------------------------------------+
|  GitHub repo  latifah-planner-data (PRIVATE, recommended)     |
|  data/latifah-planner-state.enc.json                          |
+---------------------------------------------------------------+
```

**Principles**
- LocalStorage is never bypassed. The cloud is a *backup/transport*, not the live store.
- The only thing that crosses the network is the **encrypted payload + non-secret metadata**.
- The token is a **runtime input**, never a build artifact; it lives in memory by default.
- Every inbound cloud blob is decrypted, then re-validated through the **existing** `importJson` -> `hydrate` path before it can touch app state.

---

## 2. Storage target

| Question | Decision | Reason |
| --- | --- | --- |
| GitHub or BaaS? | **GitHub Contents API** | No backend, reuses user infra, matches stated preference. |
| Actions or direct API? | **Direct Contents API** | `workflow_dispatch` still needs a browser token (broader scope), is slower, and needs a second read path. See doc 01, Approach 3. |
| Which repo? | **Dedicated private repo** `latifah-planner-data` | Token can be scoped to one repo; keeps data separate from the Pages/app repo. |
| File path | **`data/latifah-planner-state.enc.json`** | Matches the suggested path; `.enc.json` signals "encrypted"; single file = simple. |
| Plain or encrypted? | **Encrypted JSON** | Mandatory if public; recommended for private (personal notes/URLs). |

---

## 3. The cloud file format

The committed file is a small JSON **envelope**. Everything except `encryptedPayload` is plaintext metadata (safe to be readable); the actual planner state is inside the ciphertext.

```jsonc
{
  "schemaVersion": 1,                 // version of THIS envelope format
  "appVersion": "1.0.0",              // app that wrote it (from package.json)
  "lastUpdatedAt": "2026-06-22T10:15:00.000Z", // when the planner data last changed
  "deviceId": "f3a9...c1",            // which device last wrote (random, non-identifying)
  "cipher": "AES-GCM",
  "kdf": {
    "name": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 210000,             // tune; >=210k recommended
    "saltB64": "...",                 // random per save
  },
  "ivB64": "...",                     // random 12-byte IV per save
  "encryptedPayload": "..."           // base64( AES-GCM( exportJson(state) ) )
}
```

### Important distinction: file metadata vs per-device metadata

Some of the suggested metadata describes the **shared file**; some describes **this device's relationship to the cloud**. They must live in different places:

| Field | Lives in | Why |
| --- | --- | --- |
| `schemaVersion`, `appVersion`, `lastUpdatedAt`, `deviceId`, `cipher`, `kdf`, `salt`, `iv`, `encryptedPayload` | **In the cloud file** | Needed by *any* device to decrypt and to judge recency. |
| `lastSyncedAt` | **LocalStorage (per device)** | "When did *this* device last sync?" is local, not a property of the file. |
| `githubFileSha` (last known) | **LocalStorage (per device)** | The `sha` this device last saw; used to detect "cloud changed underneath me." The current `sha` is always re-fetched from GitHub at sync time. |

Per-device sync metadata is stored under a new LocalStorage key, e.g. `latifah-fe-sync-meta`, **separate** from the planner state so it never pollutes the synced payload:

```jsonc
// latifah-fe-sync-meta (local only, never uploaded)
{
  "deviceId": "f3a9...c1",
  "lastSyncedAt": "2026-06-22T10:15:00.000Z",
  "lastKnownSha": "9b2c...",          // sha of the cloud file at last successful sync
  "lastSyncedLocalUpdatedAt": "2026-06-22T10:14:55.000Z" // local lastUpdatedAt at that sync
}
```

> Note: the token is deliberately **absent** from both files. It is never persisted by default.

---

## 4. Encryption design (Web Crypto, no library)

```
passphrase (user) ---PBKDF2(salt, iterations, SHA-256)---> AES-GCM key (256-bit, non-extractable)
plaintext = exportJson(state)
ciphertext = AES-GCM.encrypt(key, iv, plaintext)   // includes auth tag
upload { saltB64, ivB64, kdf, encryptedPayload }
```

- **Algorithm:** AES-GCM, 256-bit key. Authenticated -> tamper/corruption fails closed.
- **KDF:** PBKDF2, SHA-256, **>=210,000 iterations** (tune to ~250 ms on a typical device), random 16-byte salt **per save**.
- **IV:** random 12 bytes **per save** (never reused with the same key).
- **Key handling:** derive on demand; mark the `CryptoKey` non-extractable; keep it only in memory; do not store the passphrase.
- **Decryption failure** (wrong passphrase or tampered file) -> a clear, non-technical error: *"That passphrase did not unlock your cloud data."* Never auto-overwrite local data on failure.

---

## 5. Token handling (security-critical)

| Question | Decision |
| --- | --- |
| Hardcoded in code/bundle? | **Never.** No `.env`, no committed constant. |
| Who provides it? | **The user**, typed into a password field at sync time. |
| Token type | **Fine-grained PAT**, scoped to the single data repo, **Contents: Read and write** only, with an expiry (e.g. 90 days). |
| Where stored? | **In memory (React state/ref) by default.** Cleared on refresh/close. |
| SessionStorage? | **Optional opt-in only** ("Remember while this tab is open"). Cleared on tab close. Still XSS-exposed, but short-lived. |
| LocalStorage? | **Never.** Long-lived credential + XSS exfiltration risk. |
| Transport | HTTPS only, `Authorization: Bearer <token>` header. Never in a URL/query string. |

Default = in-memory. The "remember for this session" checkbox is the only path that writes the token to `sessionStorage`, and it must be clearly labelled. There must be a test asserting that, without that opt-in, **no storage contains the token**.

---

## 6. Sync operations

### 6.1 Save to Cloud (push)

```
1. state   <- current PlannerContext state
2. plain   <- exportJson(state)
3. {salt, iv, payload} <- encrypt(plain, passphrase)
4. envelope <- { schemaVersion, appVersion, lastUpdatedAt: now, deviceId, kdf, salt, iv, payload }
5. read remote sha:
     GET contents -> existing? remoteSha = file.sha : remoteSha = undefined (file not created yet)
6. conflict check (see doc section 7). If conflict -> stop and ask the user.
7. PUT contents { message, content: base64(JSON(envelope)), sha: remoteSha }
8. on success -> update local sync-meta { lastSyncedAt, lastKnownSha = response.content.sha,
                 lastSyncedLocalUpdatedAt = state.lastUpdatedAt }
```

### 6.2 Load from Cloud (pull)

```
1. GET contents -> { base64 content, sha }   (404 -> "no cloud backup yet")
2. envelope <- JSON.parse(atob(content))
3. plain    <- decrypt(envelope.payload, passphrase, envelope.salt, envelope.iv, envelope.kdf)
4. result   <- importJson(plain)             // EXISTING structural validation + hydrate
5. if !result.ok -> show error, do NOT touch app state
6. conflict check. If safe -> actions.importState(result.state)
7. update local sync-meta { lastSyncedAt, lastKnownSha = sha, lastSyncedLocalUpdatedAt }
```

> Reusing `importJson` is deliberate: cloud data goes through the **same** hardening as a manual import. (Doc 04 adds one hardening item: re-validate `noteUrl` to `http(s)` on import.)

### 6.3 Export / Import Backup (no token, always available)

- **Export:** `exportJson(state)` -> trigger a file download `latifah-planner-backup.json` (optionally offer an encrypted `.enc.json` too).
- **Import:** file picker -> `importJson(text)` -> `importState`. Already supported by the storage layer.

---

## 7. Conflict handling

We use the GitHub `sha` as the authoritative concurrency token and `lastUpdatedAt` to label recency for the user.

Definitions at sync time:
- `localChanged` = `state.lastUpdatedAt` (local) is **newer** than `syncMeta.lastSyncedLocalUpdatedAt`.
- `cloudChanged` = `remote.sha` !== `syncMeta.lastKnownSha`.

| Case | localChanged | cloudChanged | Action |
| --- | --- | --- | --- |
| In sync | No | No | Nothing to do (offer Save/Load anyway). |
| **Local is newer** | Yes | No | **Save** is safe (push). |
| **Cloud is newer** | No | Yes | **Load** is safe (pull). |
| **Both changed (CONFLICT)** | Yes | Yes | **Stop and ask** the user. |

**Conflict UI (simple, three choices):**
- **Use This Device** - overwrite cloud with local (push, force with fresh remote sha).
- **Use Cloud** - overwrite local with cloud (pull).
- **Export Backup First** - download local backup, then re-show the choice (so nothing is lost before deciding).

**No silent auto-merge.** Merging two divergent study logs / topic maps is error-prone and would confuse a non-technical user. Explicit choice + an easy backup is safer than a clever merge.

**Race during PUT:** if a `PUT` returns `409` (the file changed between our read and write), treat it as a freshly detected conflict: re-fetch, re-run the check, prompt.

---

## 8. App integration points (no code yet - just the seams)

| Concern | New module | Touches existing |
| --- | --- | --- |
| Encrypt/decrypt | `src/lib/crypto.ts` | - |
| GitHub Contents I/O | `src/lib/githubSync.ts` | - |
| Device id + sync meta + conflict math | `src/lib/syncMeta.ts` | LocalStorage |
| Sync state + actions + in-memory token | `src/state/SyncContext.tsx` | wraps `PlannerContext` (uses `state`, `importState`) |
| UI | `src/components/sync/BackupSyncModal.tsx`, `ConflictDialog.tsx`, a header button | `src/components/layout/Header.tsx` |
| Serialize/validate reuse | - | `src/lib/storage.ts` (`exportJson`/`importJson`), `src/lib/validation.ts` |
| App version constant | - | read `version` from `app/package.json` via Vite `define` or a small constant |

The `SyncContext` reads the live `state` from `PlannerContext` for pushes, and calls `actions.importState(...)` for pulls. The two contexts compose in `App.tsx` (`ThemeProvider > PlannerProvider > SyncProvider > AppShell`).

---

## 9. UI architecture (simple, no settings page)

- **Entry point:** one small button in the existing `Header` (next to the "Saved" chip and theme toggle). Label: **"Backup & Sync"**.
- **It opens a modal** with two clearly separated sections:

```
+--------------------------- Backup & Sync ---------------------------+
|  Backup (works offline, no setup)                                   |
|    [ Export Backup ]   [ Import Backup ]                            |
|                                                                     |
|  Cloud sync (optional - keep progress across devices)               |
|    Passphrase:        [ ........... ]                               |
|    GitHub access key:  [ ........... ]  ( How do I get this? )       |
|    [ ] Remember while this tab is open                              |
|    [ Save to Cloud ]   [ Load from Cloud ]                          |
|    Last synced: 22 Jun 2026, 10:15                                  |
+---------------------------------------------------------------------+
```

- **Conflict** swaps the cloud section for the three-choice `ConflictDialog`.
- **Plain language only** in the default view; technical terms (SHA, AES, API) live behind a small "How this works / privacy" expander.
- **Errors** are human: "Could not reach GitHub. Check your internet.", "That passphrase did not unlock your cloud data.", "Your access key cannot save to this repository."

---

## 10. Why this architecture

- **Simplest thing that is actually safe:** no backend, no shipped secret, native crypto, one file.
- **Degrades gracefully:** offline -> cache; no token -> Export/Import; full -> cloud.
- **Minimal blast radius:** single-repo Contents-only token, in memory, encrypted payload.
- **Low maintenance:** zero new runtime dependencies; reuses the existing, tested storage/validation core.
- **Reversible:** if the user never opens "Backup & Sync," the app behaves exactly as it does today.
