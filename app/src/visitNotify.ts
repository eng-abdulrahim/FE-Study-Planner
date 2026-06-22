/**
 * Client-side visit notification (frontend-only).
 *
 * Runs on EVERY app load / refresh: looks up basic IP / geo info from ipinfo.io,
 * then sends a short message straight to the Telegram Bot API. There is NO
 * session/local-storage guard - the project owner wants one message per page
 * open and per refresh, so a fresh ping fires each time the entry module runs.
 *
 * SECURITY / DESIGN NOTES (read before changing):
 * - This is intentionally a FRONTEND-ONLY approach. There is no backend, server,
 *   proxy, or Cloudflare Worker involved.
 * - The Telegram bot token and chat id are bundled into the built JavaScript and
 *   are therefore PUBLIC and extractable from the deployed files. The project
 *   owner has accepted this trade-off on purpose.
 * - Everything here is BEST-EFFORT and wrapped in try/catch so a failure can
 *   never block, delay, or break the app. Nothing is ever shown in the UI.
 * - If the bot is abused, rotate the token in BotFather (the old token then stops
 *   working everywhere, including any leaked copy in old bundles).
 *
 * ENV NOTE: Vite only embeds `VITE_*` values that exist for the running mode.
 * `.env.production` is read by `npm run build`; `npm run dev` reads `.env` /
 * `.env.local` / `.env.development`. After editing any env file, RESTART the dev
 * server or REBUILD - Vite reads env at startup/build time, not per request.
 */

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string | undefined;
const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID as string | undefined;
// Enabled unless explicitly turned off with VITE_ENABLE_VISIT_NOTIFY=false.
const ENABLED = import.meta.env.VITE_ENABLE_VISIT_NOTIFY !== "false";

// Dev-only logging so it's easy to confirm the startup path actually runs.
// NEVER logs the token or the Telegram URL (both contain the secret) - only
// non-sensitive booleans / status strings. Silent in production builds.
const DEBUG = import.meta.env.DEV;
function debugVisit(message: string, data?: Record<string, unknown>): void {
  if (!DEBUG) return;
  try {
    console.info("[visitNotify]", message, data ?? "");
  } catch {
    /* never let logging break anything */
  }
}

interface IpInfo {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  org?: string;
}

/** Best-effort IP/geo lookup. Returns null on any failure (never throws). */
async function getIpInfo(): Promise<IpInfo | null> {
  try {
    debugVisit("fetching ipinfo");
    const response = await fetch("https://ipinfo.io/json");
    if (!response.ok) return null;
    return (await response.json()) as IpInfo;
  } catch {
    return null;
  }
}

/** Fire-and-forget POST to the Telegram Bot API. Swallows every error. */
function sendTelegramMessage(text: string): void {
  try {
    if (!ENABLED) return;
    if (!BOT_TOKEN || !CHAT_ID) return;

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body = new URLSearchParams({ chat_id: CHAT_ID, text });

    debugVisit("sending telegram message");
    // no-cors: we don't need to read the response, just deliver the message.
    void fetch(url, { method: "POST", mode: "no-cors", body }).catch(() => {});
    debugVisit("telegram fetch queued");
  } catch {
    // ignore notification errors
  }
}

/**
 * Entry point: build the message from page + IP info and hand it to Telegram.
 * Runs in full on every call (no session guard). Always resolves; never throws.
 */
export async function notifyVisit(): Promise<void> {
  try {
    debugVisit("notifyVisit called");
    debugVisit("config", {
      enabled: ENABLED,
      hasBotToken: Boolean(BOT_TOKEN),
      hasChatId: Boolean(CHAT_ID),
    });

    if (!ENABLED) {
      debugVisit("skipped: disabled (VITE_ENABLE_VISIT_NOTIFY=false)");
      return;
    }
    if (!BOT_TOKEN || !CHAT_ID) {
      debugVisit("skipped: missing VITE_TELEGRAM_BOT_TOKEN or VITE_TELEGRAM_CHAT_ID");
      return;
    }

    const ipInfo = await getIpInfo();

    const page = window.location.href;
    const referrer = document.referrer || "Direct";
    const userAgent = navigator.userAgent || "Unknown";
    const time = new Date().toLocaleString();

    const message = [
      "New visitor opened Latifah FE Study Planner",
      "",
      `Time: ${time}`,
      `Page: ${page}`,
      `Referrer: ${referrer}`,
      "",
      `IP: ${ipInfo?.ip || "Unknown"}`,
      `City: ${ipInfo?.city || "Unknown"}`,
      `Region: ${ipInfo?.region || "Unknown"}`,
      `Country: ${ipInfo?.country || "Unknown"}`,
      `Org: ${ipInfo?.org || "Unknown"}`,
      "",
      "User-Agent:",
      userAgent,
    ].join("\n");

    sendTelegramMessage(message);
  } catch {
    // ignore notification errors
  }
}
