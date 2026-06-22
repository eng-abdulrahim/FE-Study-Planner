# 04 - Security Risks & Mitigations

**Project:** Latifah FE Study Planner
**Context:** Static SPA on GitHub Pages, optional encrypted sync via GitHub Contents API, user-supplied token, client-side AES-GCM.

---

## 1. Threat model (who/what we defend against)

| Asset | Threat | Severity |
| --- | --- | --- |
| GitHub access token | Leak via bundle, storage, logs, or XSS -> repo write (and read, if private) | **High** |
| Planner data (notes, URLs, progress) | Public-repo exposure; commit-history exposure | Medium-High |
| Passphrase / derived key | Capture in memory, logs, or phishing | High |
| Local app integrity | Malicious imported file (XSS via note URL) | Medium |
| Data availability | Forgotten passphrase; conflict overwrite -> data loss | Medium-High |

Out of scope: a fully compromised device/browser (no web app can defend its own page against malware running locally). We minimize blast radius instead.

---

## 2. Token risks

### 2.1 Token in the bundle (CRITICAL - must never happen)
- **Risk:** Any token placed in source, `.env`, or an imported constant is **inlined by Vite into public JS** and committed/deployed -> world-readable.
- **Mitigations:**
  - Token is a **runtime input** only; typed by the user into a password field.
  - No `VITE_*` variable ever holds a token. CI/grep check: fail the build if a GitHub-token-looking pattern (`ghp_`, `github_pat_`) appears in `src/` or `dist/`.
  - `.gitignore` already excludes nothing token-related because nothing token-related is ever written to disk by the app.

### 2.2 Token persistence (where to keep it)
| Location | XSS exposure | Lifetime | Verdict |
| --- | --- | --- | --- |
| **In-memory** (React state/ref) | Only while page open | Until refresh/close | **Default - recommended** |
| **SessionStorage** | Readable by any script on origin | Until tab close | **Opt-in only**, clearly labelled |
| **LocalStorage** | Readable by any script on origin | Forever until cleared | **Never** for the token |

- **Mitigation:** default in-memory; a single, clearly labelled "Remember while this tab is open" toggle is the only path to `sessionStorage`; a "Forget key" button clears it. A unit test asserts the token is absent from both storages unless the toggle is on.

### 2.3 Over-scoped token
- **Risk:** A classic PAT or a broadly scoped token can touch all the user's repos; a leak is catastrophic.
- **Mitigations:**
  - Require a **fine-grained PAT**, **single repository** (the data repo), **Contents: Read and write** only - nothing else.
  - Recommend a **short expiry** (e.g. 90 days); the app handles "expired" with a clear re-entry prompt.
  - Document exact creation steps in the modal's "How do I get this?" helper.

### 2.4 Token in transit / logs
- **Risk:** Token in a URL, query string, or console log can leak via history, referrer, or shared screenshots.
- **Mitigations:** send only as `Authorization: Bearer` header over HTTPS; never log the token or full request; redact in any error surface; never put it in the commit message or file content.

---

## 3. Encryption risks

### 3.1 Public repo = public data (if unencrypted)
- **Risk:** A plaintext file in a public repo is readable by anyone and is preserved in commit history **forever** - even after a later "fix," old plaintext commits remain.
- **Mitigations:**
  - **Encrypt before upload, always** for public repos (AES-GCM + PBKDF2).
  - Never write a plaintext version to the cloud, not even once.
  - Prefer a **private** data repo so plaintext exposure isn't the only safeguard.

### 3.2 Weak passphrase / brute force
- **Risk:** A short passphrase on a public file invites offline brute force against the KDF.
- **Mitigations:**
  - **PBKDF2 SHA-256 with >=210,000 iterations** (tuned to ~250 ms/derivation) to slow guessing.
  - Encourage a long passphrase (length hint, not strict rules that frustrate a non-technical user).
  - Random **per-save salt** (defeats precomputation/rainbow tables) and random **per-save IV**.

### 3.3 IV reuse / nonce misuse
- **Risk:** Reusing an IV with the same key breaks AES-GCM confidentiality/integrity.
- **Mitigation:** generate a fresh 12-byte random IV for every encryption; never reuse.

### 3.4 Tampered or corrupt ciphertext
- **Risk:** A modified file could corrupt or attempt to poison local state.
- **Mitigations:** AES-GCM authentication fails closed on any tampering; decryption failure -> clear error and **no change to local state**; decrypted output still passes through `importJson` validation.

### 3.5 Key/passphrase in memory
- **Risk:** Derived key or passphrase lingering in memory.
- **Mitigations:** derive a **non-extractable** `CryptoKey`; don't store the passphrase; avoid copying it into long-lived variables/logs. (JS can't guarantee zeroing memory - accepted residual risk, minimized by short-lived scope.)

---

## 4. Forgotten passphrase (data-loss risk)

- **Risk:** By design there is **no recovery**. Lose the passphrase -> the cloud file is permanently unreadable.
- **Mitigations:**
  - **Clear, upfront warning** when first setting a passphrase: "If you forget this, your cloud backup cannot be recovered."
  - Always offer **"Export Backup"** (local plaintext file the user controls) as an independent safety net.
  - LocalStorage still holds the live data, so a forgotten passphrase loses the *cloud copy*, not the working device's data.
  - Optionally keep a **plaintext local** backup reminder; never silently store the passphrase to "help."

---

## 5. Cross-site scripting (XSS) - amplifies every other risk

XSS is the master key: it can read in-memory token, sessionStorage, and the passphrase as typed.

### 5.1 Existing, concrete issue: imported note URLs
- **Finding:** `hydrate()` in `src/lib/storage.ts` accepts `noteUrl` if it is *any string* (`typeof r.noteUrl === "string"`). It does **not** re-validate `http(s)`. The UI renders note URLs as links (`<a href={state.noteUrl}>` in `TopicRow.tsx` and `TodayCard.tsx`). The Edit drawer validates input via `isValidNoteUrl` (http/https only), but **imported/synced data bypasses that check.**
- **Impact:** a crafted backup/cloud file with `"noteUrl": "javascript:..."` could yield a clickable script-executing link -> XSS -> token/passphrase theft. This becomes more relevant once we import data from the cloud.
- **Mitigation (do this as part of Phase 1):** re-validate/sanitize `noteUrl` inside `hydrate()` (and on import) using the existing `isValidNoteUrl`; drop or blank anything not `http(s)`. Add a test with a `javascript:` URL.

### 5.2 General hardening
- React escapes text by default; keep it that way - no `dangerouslySetInnerHTML`.
- Keep dependencies at zero/minimal to shrink supply-chain XSS surface.
- Add `rel="noopener noreferrer"` on external links (already present) and consider `target="_blank"` safety.
- Consider a **Content-Security-Policy** meta tag (Pages can't set headers, but a `<meta http-equiv="Content-Security-Policy">` helps): restrict `connect-src` to `https://api.github.com` and `self`, `script-src 'self'`. Note Vite inline bootstrap may need adjustment; evaluate during implementation.

---

## 6. Conflict / overwrite (data-loss risk)

- **Risk:** Blind push/pull overwrites the other side; "both changed" silently loses one side's work.
- **Mitigations:**
  - `sha`-based optimistic concurrency: a stale `PUT` -> `409` -> treated as conflict, never a silent overwrite.
  - Explicit conflict dialog (**Use This Device / Use Cloud / Export Backup First**); no auto-merge.
  - "Export Backup First" is always one click away before any destructive choice.

---

## 7. Network, availability, and abuse

| Risk | Mitigation |
| --- | --- |
| Offline / GitHub down | App keeps working on LocalStorage; cloud buttons show a friendly retry message. |
| Rate limiting (5,000/hr authed) | Human-paced clicks are nowhere near it; debounce auto-checks; back off on `403` rate-limit. |
| Repo/path/branch typo | `404` -> "Could not find your backup location" with the expected path shown. |
| Large/garbage remote file | Size sanity check before parse; failed parse -> error, no state change. |
| CORS/API change | Pinned `Accept: application/vnd.github+json`; isolate all API quirks in `githubSync.ts` for easy fixes. |

---

## 8. Privacy

- The data includes personal study notes and note URLs. Treat it as personal data.
- Encryption + private repo keeps it private to the user's GitHub account.
- No third-party analytics/telemetry is added by this feature; the only network calls are to `api.github.com` with the user's own token.

---

## 9. Residual risks (accepted)

- A compromised device/browser extension can read anything the page can. Not solvable in-app; minimize lifetime/scope.
- JS cannot guarantee secure memory wiping of the passphrase/key.
- Forgotten passphrase is unrecoverable by design (the security property *is* the risk).

---

## 10. Security acceptance checklist (gate before release)

- [ ] No token-like string in `src/` or `dist/` (automated grep in CI).
- [ ] Token never written to `localStorage`; only to `sessionStorage` behind the explicit opt-in; cleared by "Forget key".
- [ ] Token sent only via `Authorization` header over HTTPS; never logged/URL'd.
- [ ] Fine-grained, single-repo, Contents-only token documented and required.
- [ ] AES-GCM 256 + PBKDF2 SHA-256 >=210k iters; random per-save salt + IV; non-extractable key.
- [ ] Decryption failure -> clear error, **no** local state mutation.
- [ ] `noteUrl` re-validated to `http(s)` on import/hydrate (XSS fix) + test.
- [ ] Conflict path tested; "Export Backup First" available before any overwrite.
- [ ] Forgotten-passphrase warning shown when setting a passphrase.
- [ ] (Optional) CSP meta restricting `connect-src`/`script-src` evaluated.
