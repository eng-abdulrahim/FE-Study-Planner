// Direct Telegram API test for the visit-notification bot.
//
// Verifies the configured bot token + chat id can actually deliver a message,
// WITHOUT going through the browser. Run this before testing the built app.
//
// - Loads VITE_TELEGRAM_* from the real process environment, then .env.local,
//   then .env.production (first match wins).
// - Sends ONE short test message via the Telegram Bot API.
// - Prints a SAFE summary (HTTP status + Telegram `ok` + any description).
//   The bot token and chat id are NEVER printed.
// - Missing config -> prints a clear message and exits 0 (no crash).
//
// Usage:  npm run test:telegram
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");

/** Minimal .env reader: KEY=VALUE per line, ignores comments/blank lines. */
function readEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out; // file absent -> nothing to load
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fromLocal = readEnvFile(resolve(appRoot, ".env.local"));
const fromProd = readEnvFile(resolve(appRoot, ".env.production"));

/** Precedence: real env var (non-empty) > .env.local > .env.production. */
function pick(key) {
  const live = process.env[key];
  if (live && live.trim()) return live.trim();
  if (fromLocal[key]) return fromLocal[key];
  if (fromProd[key]) return fromProd[key];
  return undefined;
}

const BOT_TOKEN = pick("VITE_TELEGRAM_BOT_TOKEN");
const CHAT_ID = pick("VITE_TELEGRAM_CHAT_ID");

if (!BOT_TOKEN || !CHAT_ID) {
  console.log("Telegram test skipped: missing configuration.");
  console.log(`  VITE_TELEGRAM_BOT_TOKEN: ${BOT_TOKEN ? "set" : "MISSING"}`);
  console.log(`  VITE_TELEGRAM_CHAT_ID:   ${CHAT_ID ? "set" : "MISSING"}`);
  console.log("Add them to .env.local or .env.production, then re-run: npm run test:telegram");
  process.exit(0);
}

const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
const text = "Telegram API test from Latifah FE Study Planner";

console.log("Sending a test message to Telegram (token + chat id hidden)...");

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ chat_id: String(CHAT_ID), text }),
  });

  let ok = false;
  let description = "";
  try {
    const data = await res.json();
    ok = data?.ok === true;
    description = typeof data?.description === "string" ? data.description : "";
  } catch {
    // non-JSON response - leave ok=false
  }

  console.log(`HTTP status: ${res.status} ${res.statusText}`.trim());
  console.log(`Telegram ok: ${ok}`);
  if (!ok && description) console.log(`Telegram says: ${description}`);

  if (ok) {
    console.log("SUCCESS: Telegram accepted the message. Check the chat.");
    process.exit(0);
  }
  console.log("FAILURE: Telegram did not accept the message (see status/description above).");
  process.exit(1);
} catch (err) {
  console.log("FAILURE: request to Telegram failed (network error).");
  console.log(`  ${err?.message ?? String(err)}`);
  process.exit(1);
}
