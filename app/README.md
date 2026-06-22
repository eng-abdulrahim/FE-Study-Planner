# Latifah FE Study Planner

A modern, **frontend-only** rebuild of the *Latifah FE Auto-Generated Study Planner* Excel workbook
as a simple, admin-style study tracker for the **FE Electrical & Computer** exam.

- **85 FE topics** across **17 sections** (~**150.5** planned hours), extracted directly from the workbook.
- No backend and no database. Everything runs in your browser (LocalStorage).
- Every edit is **saved automatically** in the browser and, optionally, **auto-synced to a private
  GitHub repository** (no need to press anything — see [Cloud sync](#cloud-sync-optional)).
- Built with **React + Vite + TypeScript**, deployable as a **static site** to GitHub Pages.

The interface is a clean admin layout: a top **Header**, a left **Sidebar**, and a **main content area**
with two pages — a **Dashboard** (the landing page, with charts) and a **Topics** page (a data table with
pagination). There is no settings page, and there are no emojis anywhere in the UI. **Light mode is the
default.**

---

## Layout

```
AppShell
├─ Header      sidebar toggle, current page title, a "Saved" status indicator, a single
│              "Sync" button (cloud sync), and a Light / Dark / System theme toggle (Light
│              is default). On mobile the header shows the brand "Latifah FE Study Planner".
├─ Sidebar     brand "Latifah FE Study Planner" + "Electrical & Computer", navigation: Dashboard,
│              Topics. Collapses to an icon rail (240px <-> 72px) on desktop and to a drawer on
│              mobile; the collapsed state is saved (key `latifah-fe-sidebar-collapsed`).
└─ Main        Dashboard (default) or Topics
```

The app always opens on the **Dashboard** in **Light mode**. There is no settings page and no emojis
anywhere in the UI (navigation uses inline SVG icons).

---

## Dashboard (landing page)

A calm overview of where you stand, built from the same logic that powered the Excel workbook:

- **Today's focus** — a full **multi-block daily plan**, not a single topic. Each day's available time is
  split into several short, purpose-built blocks (learn / review / practice / formula recap / mixed FE
  practice / light review) shown as a calm, read-only overview (type, topic, minutes, short instruction),
  with a supportive headline ("Today's target …"), a blocks/done summary, and a **topics covered** count.
  The card stays deliberately uncluttered, exposing exactly three controls: **Mark Done / Undo Done**
  (marks the whole day's blocks done, reversibly), a **Day mode** popover (Normal / Not in mood / Family /
  Travel / Work, with a subtle badge when not normal), and **Skip today / Unskip today**. Granular
  per-block **Done / Skip / Undo** lives in **This week** (today is its first day). Plan-shaping nudges
  (Light day / More practice / More review / Focus weak topics / Include all topics) and **Regenerate** now
  live in the **This week → Manage** menu. The engine and its design live in `src/lib/dailyPlan.ts` and
  `docs/study-plan/`.
- **Exam date** — an editable `type="date"` input (default **2026-07-22**, shown as **22 Jul 2026**)
  that saves automatically to `examDate`. Changing it immediately updates the countdown, pacing, and the
  **Final review phase** flag (active when 14 or fewer days remain).
- **Summary cards** — days remaining, completed hours, remaining hours, preparation level, this week's
  progress, and a **Gentle reminder** card that shows a short, supportive daily study note (one of 30 messages,
  cycling once per day). The dashboard intentionally avoids discouraging "behind schedule" wording; pacing
  is still computed internally to drive scheduling, it is just not shown as negative text.
- **This week** — a rolling 7-day list of calm day **summaries** (today highlighted). Each day shows its
  total time, block count, and a preview of its top blocks; expand a day to see the full block list (each
  with **Done** / **Skip**) plus compact day controls (mode, skip, regenerate this day). A coverage line
  shows topics covered / remaining / to strengthen, and a header **Manage** menu offers **Regenerate week**
  (keeps locked days and anything already done) and **Clear manual changes**.
- **Top topics to study** — the five highest-priority topics as a simple ranked list.
- **Charts** (dependency-free SVG/CSS, theme-aware):
  - Overall progress (donut)
  - Status distribution
  - Tier distribution
  - Top priority topics
  - Weekly minutes: planned vs completed

No charting library is used; the charts are small SVG/CSS components in `src/components/charts/` so there
is no extra bundle weight and they follow light/dark mode automatically.

---

## Topics page

A clean, readable table for managing the topic list — **not** a wall of inputs, and the main place to manage
completion. Columns:

| # | Topic | Section | Tier | Status | Done | Progress | Notes | Actions |

- **Done toggle** — a reversible per-topic control: mark a topic Done, or toggle it back (it reopens to
  *reviewing* if it has logged hours, else *not-started*, and re-enters planning). Persists + auto-saves. On
  mobile it appears on each topic card.
- **Search** — by topic name or section.
- **Filters** — Section, Tier, Status, Include (one compact row on desktop; collapsed behind a **Filters**
  button on mobile, with search always visible).
- **Sorting** — click a header to sort by Topic, Section, Tier, Status, or Progress (click again to
  reverse).
- **Editing via a drawer** — each row has an **Edit** button that opens a side drawer with Status,
  Include, Confidence, Completed hours, and Note URL (Section / Tier / Planned hours are shown as
  read-only reference). Press **Save** to apply or **Cancel/Close**/Escape to discard.
- **Notes** — the table shows **Add note** when empty and **Open note** (opens in a new tab) when a link
  exists. The raw URL input lives only inside the Edit drawer and is softly validated as `http(s)`.
- **Pagination** — page sizes of 10 / 25 / 50 with First / Prev / Next / Last and a
  "Showing 1–10 of 85 topics" summary. The page resets to 1 when search or filters change.

### Responsiveness

On narrow screens the table scrolls **horizontally inside its own container** (the page body never scrolls
sideways), filters collapse, pagination wraps, and the sidebar becomes a drawer opened from the header
menu button.

---

## Run locally

Requires Node 18+ (developed on Node 22).

```bash
cd app
npm install
npm run dev        # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build      # type-check + produce static files in dist/
npm run preview    # serve the built dist/ locally (http://localhost:4173)
npm run test       # run the Vitest logic tests
```

---

## Deploy to GitHub Pages

The build uses a **relative base** (`base: "./"` in `vite.config.ts`) and **no router**, so the static
`dist/` works under any GitHub Pages subpath without 404-on-refresh issues.

### Option A — GitHub Actions (recommended)

A workflow is included at `.github/workflows/deploy.yml`.

1. Push this project to a GitHub repo (the app lives in the `app/` subfolder; the workflow already
   `cd`s into it).
2. In the repo: **Settings -> Pages -> Build and deployment -> Source -> GitHub Actions**.
3. Push to `main`. The workflow runs tests, builds, and publishes `app/dist`.

### Option B — manual (`gh-pages` branch)

```bash
cd app
npm run deploy     # builds and pushes dist/ to the gh-pages branch
```

Then set **Settings -> Pages -> Source -> Deploy from a branch -> `gh-pages` / root**.

---

## How your data is saved

- Topic edits are stored in **LocalStorage** under the key **`latifah-fe-planner-v1`**.
- The theme preference is stored separately under **`latifah-fe-theme`**.
- **Auto-save**: every edit (include, status, completed hours, confidence, note URL) is written
  immediately. The header shows a **Saved** indicator.
- The storage schema is **versioned** (`STORAGE_VERSION`) and the loader is **self-healing**: it merges
  saved data over the 85 default topics, clamps out-of-range values, drops unknown topics, and adds new
  ones, so older saved data keeps working after updates.

### Limitations of local storage

- Without cloud sync, data is tied to **one browser on one device**. Clearing site data, using private
  mode, or switching browsers starts fresh.
- Optional cloud sync (below) adds cross-device sync, but there is still no multi-account server.
- To reset everything, clear this site's data in your browser. (There is no settings page and no raw JSON
  exposed in the UI by design.)

---

## Cloud sync (optional)

This app can keep your progress in a **private GitHub repository** so you can open it on another device
and pick up where you left off. There is **no settings screen** and **no prompts**: saving and loading
both happen automatically.

- **Automatic save — you never click to save.** Any planner change (topic status, confidence, completed
  hours, note URL, marking a day done, exam date, availability, etc.) saves to LocalStorage instantly and
  then auto-pushes to GitHub after a short debounce (~4s). Rapid edits collapse into a single write. The
  button shows the spinner and a **Saving... / Saved** status while this happens.
- **Automatic load — you never click to load.** The latest cloud data is pulled in the background when you
  open the app, when you return to the tab, and on a light interval (~60s). Background loads are quiet (no
  spinner) and only flash **Synced** when they actually bring in newer data.
- **Conflicts resolve themselves (newest wins).** If the same file changed on GitHub *and* locally since
  the last sync, the app keeps whichever side was **edited most recently** — no popup, no choice to make.
  Your in-progress edits win over older cloud data; genuinely newer cloud data replaces older local data.
- **One optional button.** The header's single **Sync** button just forces an immediate sync; you never
  *need* it. It shows **Syncing... / Synced / Sync failed**.
- **Plain JSON.** State is stored unencrypted as a JSON envelope at
  `apps/fe-study-planner/planner-state.json` in the data repo.
- **Validated on load.** Anything pulled from GitHub goes through the same import/hydrate validation as a
  manual import (including stripping unsafe `javascript:` / `data:` note URLs).

### Configuration

All sync settings live in **`src/config/syncConfig.ts`**:

```ts
export const SYNC_CONFIG = {
  owner: "eng-abdulrahim",
  repo: "private-data-store",
  branch: "main",
  path: "apps/fe-study-planner/planner-state.json",
  token: "PASTE_GITHUB_TOKEN_HERE",
} as const;
```

Replace `PASTE_GITHUB_TOKEN_HERE` with a **fine-grained personal access token** that is:

- **Repository-scoped** to `eng-abdulrahim/private-data-store` only,
- **Contents: Read and write**,
- **Metadata: Read-only**.

Until a real token is pasted, sync stays off and the button reports that the token is missing.

### Security tradeoff (read this)

> **The token is embedded in the frontend bundle.** Anyone who can open the built site or read its
> JavaScript can extract it. This is **intentionally accepted for personal/private use only** and is
> **not** safe for a shared or public deployment.
>
> Keep the token **fine-grained and scoped to the single private data repo** so the worst case stays
> contained. **If the token is ever exposed publicly or no longer needed, revoke it on GitHub and
> generate a new one.** Do not commit a real token to a public repository.

The token is only ever sent in the `Authorization` header. It is never stored in LocalStorage, never
written into the synced JSON file, never logged, and never put in commit or error messages.

---

## Telegram visit notification (optional)

A tiny, frontend-only ping (`src/visitNotify.ts`) that sends a short message to a Telegram chat when
someone opens the app. It is **best-effort and silent**: it runs on app load, never blocks
rendering, never shows anything in the UI, and any failure is swallowed.

- **Runs on every page open AND refresh.** It fires from the entry module (`src/main.tsx`), so each
  full page load sends a fresh message. There is **no** session/local-storage guard.
- **Looks up basic IP/geo info** from [`ipinfo.io/json`](https://ipinfo.io/json) (IP, city, region,
  country, org). Missing values fall back to `Unknown`.
- **Sends a message** to the **Telegram Bot API** (`/sendMessage`) with the time, page URL, referrer,
  IP/geo info, and user agent.
- **Frontend-only.** There is no backend, server, proxy, or Worker.
- **Dev logging.** In `npm run dev` the console shows `[visitNotify] ...` lines (e.g. `notifyVisit
  called`, `sending telegram message`, or `skipped: missing ...`). The token/URL are never printed. You
  can also fire it on demand from the console with `window.__testVisitNotify()` (dev only).

### Security tradeoff (read this)

> **The bot token and chat id are bundled into the built JavaScript and are PUBLIC.** Vite embeds the
> `VITE_*` values into the bundle at build time — **even if `.env.production` is gitignored** — so anyone
> who reads the deployed files can extract them. This is **intentionally accepted** for this project.
>
> Keep the bot scoped to what you're comfortable exposing. **If the bot is ever abused, rotate the token
> in BotFather** (the old token immediately stops working everywhere, including in old bundles).

### Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_TELEGRAM_BOT_TOKEN` | Bot token from BotFather. **Public in the bundle.** |
| `VITE_TELEGRAM_CHAT_ID` | Target chat id (user, group, or channel). |
| `VITE_ENABLE_VISIT_NOTIFY` | Optional. Set to `false` to disable the ping entirely. |

**Which env file?** Vite only embeds the `VITE_*` values that exist **for the mode it is running in**:

- `npm run dev` (development) reads `.env`, `.env.local`, `.env.development` — **not** `.env.production`.
- `npm run build` / `npm run preview` (production) read `.env`, `.env.local`, `.env.production`.

So put the values in **`.env.local`** to cover both dev and build (this is why `npm run dev` sends the
ping), or in `.env.production` for builds only. See `.env.example` for the template.

> **After editing any `.env*` file, RESTART the dev server (`npm run dev`) or REBUILD (`npm run build`).**
> Vite reads env at startup/build time, not per request — a stale dev server is the most common reason a
> newly added token "does nothing".

If the token or chat id is missing, the notification simply does nothing (in dev the console logs
`[visitNotify] skipped: missing VITE_TELEGRAM_BOT_TOKEN or VITE_TELEGRAM_CHAT_ID`). The real `.env*`
files are gitignored (only `.env.example` is committed), but the values still end up in the public build.

```text
Telegram visit notification is frontend-only.
The bot token and chat id are embedded in the built JavaScript bundle.
Anyone with access to the deployed app can extract them.
This is accepted for this project.
If abused, rotate the bot token in BotFather.
```

### Verifying it works

1. **Put real values** in `.env.local` (preferred for local testing) or `.env.production`:

```env
VITE_ENABLE_VISIT_NOTIFY=true
VITE_TELEGRAM_BOT_TOKEN=REAL_BOT_TOKEN
VITE_TELEGRAM_CHAT_ID=REAL_CHAT_ID
```

2. **Test the Telegram API directly** (no browser). This sends one `Telegram API test ...` message and
   prints a safe summary (HTTP status + Telegram `ok`); the token/chat id are never printed:

```bash
npm run test:telegram
```

   Success looks like `Telegram ok: true` and a message arriving in the chat. Missing config exits
   cleanly with a clear note instead of crashing.

3. **Browser end-to-end** (Playwright, already a dev dependency). Runs a throwaway dev server with a
   dummy token (your real `.env.production` is not loaded and no real message is sent), mocks
   `ipinfo.io/json`, intercepts the Telegram request, asserts the outgoing body, **and reloads the page
   to confirm a second request fires** (proving there is no once-per-session guard):

```bash
npx playwright install chromium   # one-time
npm run test:visit:e2e
```

4. **Manual smoke test** of the real build:

```bash
npm run build
npm run preview
```

   Open the preview URL. The chat should receive a message that starts with
   `New visitor opened Latifah FE Study Planner` and contains Time, Page, Referrer, IP, City, Region,
   Country, Org, and the User-Agent. It fires once per browser tab/session.

---

## Project structure

```
app/
├─ index.html
├─ vite.config.ts            # base: "./", Vitest config
├─ src/
│  ├─ app/App.tsx            # ThemeProvider + PlannerProvider + SyncProvider + AppShell
│  ├─ components/
│  │  ├─ layout/             # AppShell (page routing), Header, Sidebar, ThemeToggle
│  │  ├─ common/             # Badge, Button, Popover (outside-click + escape)
│  │  ├─ dashboard/          # DashboardPage, TodayCard, TaskRow, SummaryCards, WeeklyPlanPreview, WeeklyDaySummary, TopTopics, ChartsSection
│  │  ├─ charts/             # Donut, BarList, WeeklyBars (dependency-free SVG/CSS)
│  │  ├─ topics/             # TopicsPage, TopicTableFilters, TopicsTable, TopicRow, TopicPagination, TopicEditDrawer
│  │  ├─ sync/               # SyncButton (single header button + animation)
│  │  └─ common/             # Button, Badge, EmptyState, icons (inline SVG)
│  ├─ config/
│  │  └─ syncConfig.ts       # fixed repo target + embedded token (see Cloud sync)
│  ├─ data/
│  │  ├─ topics.ts           # 85 topics auto-extracted from the workbook
│  │  ├─ topicOptions.ts     # single source of truth: status/confidence options, labels, migration
│  │  ├─ dayModes.ts         # day-mode options, caps, task/Today text (Normal/Family/Travel/Work/Not in mood)
│  │  └─ defaults.ts         # tiers, status→progress, includes, availability, thresholds
│  ├─ hooks/                 # useTheme (Light/Dark/System), useMediaQuery
│  ├─ lib/
│  │  ├─ priority.ts         # Priority score shown in the table
│  │  ├─ readiness.ts  pacing.ts  scheduler.ts   # kept in lib (computed model helpers)
│  │  ├─ plannerLogic.ts     # aggregates topics into the UI model (incl. multi-task plan + coverage)
│  │  ├─ dailyPlan.ts        # multi-task daily-plan engine (blocks, coverage, day modes, final review)
│  │  ├─ planActions.ts      # pure task done/skip/reset + plan-tuning transforms
│  │  ├─ dayOverrides.ts     # pure per-date transforms (mode/skip/topic/minutes/lock/move/regenerate)
│  │  ├─ studyActions.ts     # pure mark-done / undo-done study-log transforms
│  │  ├─ weekView.ts         # split week into active / completed; weekly planned minutes
│  │  ├─ topicSearch.ts      # pure topic filter (search + section) for the picker
│  │  ├─ dateUtils.ts        # exam-date helpers (parse/format/days/weeks remaining)
│  │  ├─ githubSync.ts       # thin GitHub Contents API client (token passed in, never stored)
│  │  ├─ syncEngine.ts      # framework-agnostic sync orchestration (auto-save/load, newest-wins)
│  │  ├─ syncMeta.ts  syncEnvelope.ts  syncStatus.ts  autoPush.ts   # sync bookkeeping + helpers
│  │  ├─ storage.ts  validation.ts  labels.ts  util.ts
│  │  └─ *.test.ts           # Vitest logic tests
│  ├─ state/
│  │  ├─ PlannerContext.tsx  # state + auto-save + actions
│  │  ├─ SyncContext.tsx     # cloud sync: debounced auto-push + background auto-load
│  │  └─ ThemeProvider.tsx
│  ├─ types/planner.ts
│  ├─ visitNotify.ts         # frontend-only, best-effort Telegram visit ping (see Telegram section)
│  └─ styles/                # theme.css, globals.css, layout.css, dashboard.css, table.css, sync.css
└─ .github/workflows/deploy.yml
```

See **[`docs/LOGIC.md`](docs/LOGIC.md)** for the exact formulas (priority, readiness, pacing, scheduler,
storage schema), and **[`docs/study-plan/`](docs/study-plan/)** for the success strategy and the
multi-task 28-day planner algorithm design.

---

## Data provenance

Topic data (`src/data/topics.ts`) is extracted verbatim from
`Latifah_FE_Auto_Generated_Study_Planner.xlsx` (the `Topic Planner` sheet): section, topic name, question
range, exam weight, tier, planned hours, and the default confidence/difficulty/status/include values.
Tiers and action thresholds were recreated from the hidden `_Lists` / `_Calc` engine sheets. No topic
values were invented.

**Frontend-only confirmation:** the app has no backend of its own. Its only network calls are the
**optional** GitHub Contents API requests used by auto-save / auto-load (and the manual Sync button). When you add a token, it is
embedded in the bundle for personal/private use (see [Cloud sync](#cloud-sync-optional)); with the default
placeholder, the app makes no network calls and all state lives in the browser (LocalStorage).
