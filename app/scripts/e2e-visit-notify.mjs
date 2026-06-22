// Browser e2e check for the visit notification (Playwright).
//
// Proves that simply OPENING the app triggers the visitor ping end to end:
//   1. a request to https://ipinfo.io/json (mocked with deterministic data), and
//   2. a POST to the Telegram Bot API whose body carries the expected message.
//
// It runs a throwaway dev server in `--mode e2e` so it reads a temporary
// `.env.e2e` with a DUMMY token (the real `.env.production` is never loaded and
// no real Telegram message is sent). Telegram is intercepted and faked, so the
// opaque no-cors response is irrelevant - we assert the OUTGOING request/body.
//
// Usage:  npm run test:visit:e2e   (chromium must be installed: npx playwright install chromium)
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const envPath = resolve(appRoot, ".env.e2e");

const IPINFO = { ip: "1.2.3.4", city: "Test City", region: "Test Region", country: "TC", org: "Test Org" };
const EXPECTED = [
  "New visitor opened Latifah FE Study Planner",
  "IP: 1.2.3.4",
  "City: Test City",
  "Region: Test Region",
  "Country: TC",
  "Org: Test Org",
];

let server;
function killServer() {
  if (!server?.pid) return;
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    else server.kill("SIGTERM");
  } catch {
    /* ignore */
  }
}

function startDevServer() {
  return new Promise((resolveUrl, reject) => {
    server = spawn("npx vite --mode e2e --clearScreen false --port 5199", {
      cwd: appRoot,
      shell: true,
    });
    const timer = setTimeout(() => reject(new Error("dev server did not start in time")), 30000);
    const onData = (buf) => {
      const m = String(buf).match(/(http:\/\/localhost:\d+\/?)/);
      if (m) {
        clearTimeout(timer);
        resolveUrl(m[1]);
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`dev server exited early (code ${code})`));
    });
  });
}

let browser;
const failures = [];

try {
  writeFileSync(
    envPath,
    [
      "VITE_ENABLE_VISIT_NOTIFY=true",
      "VITE_TELEGRAM_BOT_TOKEN=e2e-test-token",
      "VITE_TELEGRAM_CHAT_ID=e2e-chat-id",
      "",
    ].join("\n"),
  );

  const baseUrl = await startDevServer();
  console.log(`dev server up at ${baseUrl}`);

  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture every Telegram request so we can prove BOTH the initial open and a
  // refresh each send (i.e. there is no once-per-session guard).
  const telegramHits = [];
  const waitForHits = (n, timeoutMs) =>
    new Promise((resolveWait, rejectWait) => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (telegramHits.length >= n) {
          clearInterval(iv);
          resolveWait();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          rejectWait(new Error(`timed out waiting for ${n} Telegram request(s) (got ${telegramHits.length})`));
        }
      }, 100);
    });

  await page.route("https://ipinfo.io/json", (route) =>
    route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(IPINFO),
    }),
  );
  await page.route("https://api.telegram.org/**", (route) => {
    telegramHits.push({ url: route.request().url(), postData: route.request().postData() });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  // 1) Opening the page must send a Telegram request with the expected body.
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForHits(1, 20000);

  const first = telegramHits[0];
  if (!first?.url || !/api\.telegram\.org\/bot.+\/sendMessage/.test(first.url)) {
    failures.push(`Telegram URL was not the expected sendMessage endpoint (got: ${first?.url})`);
  }
  const text = new URLSearchParams(first?.postData || "").get("text") || "";
  for (const needle of EXPECTED) {
    if (!text.includes(needle)) failures.push(`message body missing: "${needle}"`);
  }

  // 2) Refreshing must send AGAIN (proves the session guard was removed).
  await page.reload({ waitUntil: "domcontentloaded" });
  try {
    await waitForHits(2, 20000);
  } catch {
    failures.push("refresh did not send a second Telegram request (session guard still present?)");
  }

  if (failures.length === 0) {
    console.log(
      `PASS: open + refresh each sent ipinfo + Telegram requests (${telegramHits.length} sends) with the expected body.`,
    );
  } else {
    console.log("FAIL:");
    for (const f of failures) console.log(`  - ${f}`);
    console.log("--- captured message text ---");
    console.log(text || "(empty)");
  }
} catch (err) {
  failures.push(err?.message ?? String(err));
  console.log(`ERROR: ${err?.message ?? err}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  killServer();
  rmSync(envPath, { force: true });
}

process.exit(failures.length === 0 ? 0 : 1);
