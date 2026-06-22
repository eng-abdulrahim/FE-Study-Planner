# 01 - Cloud Sync Feasibility Analysis

**Project:** Latifah FE Study Planner
**Status:** Analysis only - no app code changed
**Goal:** Let one non-technical user open the planner on any device and keep the same progress, notes, exam date, availability, and study log.

---

## 1. What we are syncing (current state of the app)

All user data already lives in a single, well-structured object and is persisted to the browser.

| Item | Where it is today | Relevant code |
| --- | --- | --- |
| Planner state (topics, status, notes, exam date, availability, study log, UI prefs) | LocalStorage key `latifah-fe-planner-v1` | `app/src/lib/storage.ts` |
| Theme preference | LocalStorage key `latifah-fe-theme` | `app/src/hooks/useTheme.ts` |
| Sidebar collapsed | LocalStorage key `latifah-fe-sidebar-collapsed` | `app/src/components/layout/AppShell.tsx` |

Key fact: **the app is already 80% ready for sync.** `src/lib/storage.ts` already exposes:

- `exportJson(state)` - serialize the full state to a JSON string.
- `importJson(text)` - parse + structurally validate + `hydrate()` back into a safe state.
- `hydrate(raw)` - self-healing loader that merges saved data over the 85 default topics, clamps numbers, drops unknown topics, adds new ones.
- `validateImportedState(raw)` in `src/lib/validation.ts` - structural checks (valid `examDate`, `topics` object, arrays where expected).

And `src/state/PlannerContext.tsx` already exposes an `importState(next)` action that swaps in a new state and auto-saves.

**Implication:** We do *not* need to invent a data format. Cloud sync = (a) take what `exportJson` produces, (b) optionally encrypt it, (c) put/get it from a remote, (d) feed it back through the existing `importJson`/`importState` path. The sync layer can sit cleanly on top of the existing storage layer.

### Data size (feasibility check)

- 85 topics x ~8 small fields + a study log + 7 availability rows.
- Realistic serialized size: **5-40 KB** plaintext; encrypted + base64 adds ~35%, so well under **~60 KB**.
- This is far below every relevant limit (GitHub Contents API ~1 MB/file, LocalStorage ~5 MB). Size is a non-issue.

---

## 2. Hard constraints from this project

These shape every recommendation below:

1. **Static hosting only (GitHub Pages).** No server, no server-side secrets, no Node runtime at request time. Anything "backend-like" must be a third-party service or the user's own GitHub.
2. **No secret may ship in the bundle.** Vite inlines `import.meta.env.*` and any imported constant into the public JS. A committed token would be world-readable. So any credential must be **entered by the user at runtime**.
3. **Non-technical user.** The flow must be a few clearly labelled buttons, not a configuration screen full of jargon (no "SHA", "API", "PAT", "AES" in the normal path).
4. **Must stay simple and dependency-light.** The app currently has **zero runtime dependencies** beyond React. A sync solution that keeps that property is strongly preferred.
5. **No Settings page, no router.** UI must be a small modal/panel reachable from the existing `Header`.

---

## 3. Approach-by-approach analysis

### Approach 1 - LocalStorage only + Export / Import JSON backup

**How:** Add an "Export Backup" button (downloads `latifah-planner-backup.json`) and an "Import Backup" button (file picker -> `importJson`). The user moves the file between devices themselves (cloud drive, email, USB).

| Pros | Cons |
| --- | --- |
| Zero infrastructure, zero secrets, zero network. | Not real "sync" - manual file shuffling. |
| Safest possible (data never leaves the device unless the user sends it). | Easy to import a stale file and lose progress. |
| ~90% already implemented (`exportJson`/`importJson`). | No automatic "latest wins" - user must track which file is newest. |
| Works fully offline. | Friction grows with frequency of switching devices. |

**Verdict:** **Feasible today, near-zero risk.** Not a complete answer to "any device automatically," but it is the correct **foundation and permanent fallback**. Should be shipped first (MVP Phase 0).

---

### Approach 2 - GitHub Pages + GitHub REST Contents API (direct from browser)

**How:** The browser calls `https://api.github.com/repos/{owner}/{repo}/contents/{path}` with a user-supplied token.
- **Load:** `GET` -> returns base64 `content` + a `sha`.
- **Save:** `PUT` with base64 `content`, a commit `message`, and the previous `sha` (required when updating an existing file).

**Feasibility facts (verified against how the GitHub API behaves):**
- `api.github.com` **supports browser CORS**, so direct `fetch` from a Pages-hosted SPA works.
- Authenticated rate limit is **5,000 requests/hour** - astronomically more than a human clicking Save/Load needs.
- The `sha` returned on read is a perfect **optimistic-concurrency token**: a `PUT` with a stale `sha` fails with `409 Conflict`, which is exactly the signal we need for conflict detection.
- File-size limit via this API (~1 MB) is irrelevant at our ~60 KB ceiling.

| Pros | Cons |
| --- | --- |
| True cross-device sync with **no backend to run or pay for**. | Requires a **GitHub token in the browser** (the central risk). |
| Reuses infrastructure the user already has (GitHub account + repo). | User must create a fine-grained token once (one-time friction). |
| `sha` gives us built-in conflict detection for free. | Token can expire -> occasional re-entry. |
| No new runtime dependency (native `fetch`). | Public repo would expose data unless encrypted. |

**Verdict:** **Feasible and the best fit** for the stated preference ("GitHub as storage, no backend, simple"). The token risk is **manageable** by (a) never storing it in the bundle, (b) entering it manually, (c) keeping it in memory, (d) using a fine-grained token limited to one repo with only Contents read/write. This is the recommended core of the sync feature.

---

### Approach 3 - GitHub Pages + GitHub Actions `workflow_dispatch`

**How:** The browser triggers a workflow via `POST .../actions/workflows/{id}/dispatches`; the workflow runs on GitHub's servers and commits the JSON using the built-in `GITHUB_TOKEN`.

**The fatal problem:** triggering `workflow_dispatch` from the browser **still requires a user token** in the browser, this time with `actions: write` permission - a *broader* scope than Contents-only. So it does **not** remove the in-browser-token risk; it makes it worse.

Additional downsides:
- **Latency:** a workflow takes seconds-to-minutes. A "Save" button that doesn't confirm for a minute is bad UX.
- **Read path still needs something else** (Contents API or the raw file URL) to load data back, so you build *two* mechanisms.
- **More moving parts** (a YAML workflow + dispatch plumbing) for a non-technical user to keep working.

**Verdict:** **Rejected.** More complexity, broader token scope, worse latency, and no security benefit over Approach 2. `workflow_dispatch` only makes sense when an authenticated server (not a static SPA) triggers it.

---

### Approach 4 - Encrypted JSON file stored in the repo

**How:** Before upload, encrypt the planner JSON in the browser with **Web Crypto AES-GCM**, using a key derived from a **user passphrase via PBKDF2** (random salt, random IV per save). The committed file holds only ciphertext + the parameters needed to decrypt (salt, IV, KDF params) - never the passphrase or key.

**Feasibility facts:**
- `window.crypto.subtle` (AES-GCM, PBKDF2) is available in all modern browsers and on GitHub Pages (HTTPS context required - Pages is HTTPS). **No library needed.**
- AES-GCM is authenticated: tampering or corruption fails decryption loudly (good - we never feed garbage into `importJson`).

| Pros | Cons |
| --- | --- |
| Data is unreadable in the repo (and in commit history) without the passphrase. | **Forgotten passphrase = permanently unrecoverable cloud data** (by design). |
| Native, dependency-free. | Slightly more UI (one passphrase field) + clear warnings needed. |
| Makes a **public repo acceptable**, and hardens a private repo. | Adds CPU cost on save/load (negligible at this size). |

**Verdict:** **Feasible and strongly recommended** - **mandatory** if the repo is public, and recommended even for a private repo because the data includes personal notes and note URLs. Forgotten-passphrase risk is mitigated by (a) clear warnings, (b) always offering "Export Backup" of the plaintext locally, (c) never promising recovery.

---

### Approach 5 - Private repo vs public repo implications

| | Public repo | Private repo |
| --- | --- | --- |
| Who can read the file | **Anyone on the internet** | Only you / collaborators |
| Encryption needed | **Yes, mandatory** | Recommended (defense in depth) |
| Commit history risk | Every past version is public forever - one accidental plaintext commit leaks permanently | History is private |
| Token sensitivity | Token still needed for write; a leaked token can write/spam | A leaked token can **read your private repo** - higher blast radius |
| Setup friction (non-technical) | Slightly simpler (no access management) | One extra step to create a private repo |

**Key insight - use a dedicated data repo:** rather than reusing the app/Pages repo, recommend a **separate private repo just for data** (e.g. `latifah-planner-data`). Benefits:
- The token can be a **fine-grained PAT scoped to that one repo**, Contents read/write only. A leak cannot touch the app repo or anything else.
- App code and personal data stay cleanly separated.
- If the user ever makes the app repo public for Pages, the data repo stays private.

**Verdict:** Recommend **private dedicated data repo + encryption**. If the user insists on a public repo, encryption is non-negotiable and they must never commit plaintext.

---

### Approach 6 - Supabase / Firebase instead of GitHub

**How:** A backend-as-a-service stores the state in a row/document; the app authenticates the user (email or anonymous) and reads/writes through a public anon key, with access enforced server-side (Supabase Row-Level Security / Firebase Security Rules).

| Pros | Cons |
| --- | --- |
| Purpose-built for sync; real auth; potential real-time updates. | Requires creating + configuring a cloud project (auth, rules) - heavier for a non-technical solo user. |
| The shipped anon key is **not a secret** (safe in the bundle; security is server-side rules). | Adds an **SDK dependency** + bundle weight (breaks the zero-dependency property). |
| Scales to multi-user / sharing later. | Vendor lock-in; free-tier limits and project can be paused for inactivity. |
| Could enable field-level merge/conflict handling. | Contradicts the explicit "GitHub as storage, keep it simple, no backend" preference. |

**Verdict:** **Technically the most robust** option and the right choice **if requirements grow** (multiple users, sharing, real-time). For the current goal - one non-technical user who already has the data locally and wants simple cross-device continuity - it is **overkill** and heavier to set up than the GitHub path. Document it as the recommended upgrade path, not the MVP.

---

### Approach 7 - Hybrid (LocalStorage cache + optional encrypted GitHub sync)

**How:** Keep **LocalStorage as the always-on source of truth / offline cache** (no change to the existing read/write flow). Layer an **optional** "Backup & Sync" feature on top:
- **Always available, no setup:** Export Backup / Import Backup (Approach 1).
- **Opt-in cloud:** encrypted GitHub Contents sync (Approaches 2 + 4 + 5) with a manually entered, in-memory token and a passphrase.

| Pros | Cons |
| --- | --- |
| App keeps working exactly as today for users who never touch sync. | Two code paths (backup vs cloud) - but they share the same serialize/validate core. |
| Graceful degradation: offline -> LocalStorage; no token -> Export/Import; full -> cloud. | Conflict handling must be designed (covered in doc 02/04). |
| Reuses `exportJson`/`importJson`/`importState` - minimal surface area. | |
| Zero new runtime dependencies. | |

**Verdict:** **This is the recommended shape of the solution.** It satisfies "any device," "simple," "safe," and "keep LocalStorage as offline cache" simultaneously.

---

## 4. Feasibility summary table

| Approach | Real cross-device sync | Backend needed | Secret in bundle | Beginner-friendly | New deps | Recommended |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Export/Import only | Manual | No | No | Medium | No | **Yes - as foundation** |
| 2. GitHub Contents API | **Yes** | No | No (user token) | Medium | No | **Yes - core** |
| 3. GitHub Actions dispatch | Yes | No | No (broader token) | Low | No | No |
| 4. Encrypted file | n/a (modifier) | No | No | Medium | No | **Yes - mandatory if public** |
| 5. Private data repo | n/a (modifier) | No | No | Medium | No | **Yes** |
| 6. Supabase/Firebase | Yes | Managed | No (anon key) | Low setup | Yes | Later / if scope grows |
| 7. Hybrid (1+2+4+5) | **Yes** | No | No | **Yes (layered)** | No | **Yes - overall design** |

---

## 5. Conclusion of feasibility

Cross-device sync is **feasible without any backend**, by combining:

- **Hybrid design (Approach 7):** LocalStorage stays the live cache; sync is an optional layer.
- **GitHub REST Contents API (Approach 2)** for storage, **not** Actions (Approach 3).
- **AES-GCM + PBKDF2 client-side encryption (Approach 4)**, mandatory if the repo is public.
- **A dedicated private data repo (Approach 5)** with a fine-grained, single-repo, Contents-only token entered manually and kept in memory.
- **Export/Import (Approach 1)** shipped first as the zero-risk MVP and permanent fallback.

Supabase/Firebase (Approach 6) is the better choice only if the project later needs multiple users, sharing, or real-time sync.

Detailed architecture is in `02_Recommended_Architecture.md`; the build order is in `03_Implementation_Plan.md`; the threat model is in `04_Security_Risks.md`; the decision is in `05_Final_Recommendation.md`.
