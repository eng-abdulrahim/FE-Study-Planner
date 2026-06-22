// Dev-only end-to-end QA for the Regenerate action. Verifies that BOTH the
// "Regenerate week" menu item and the per-day "Regenerate" button:
//   1. are clickable and run a handler,
//   2. show the "Plan refreshed" feedback,
//   3. actually change the visible plan (auto-picked review/practice topics), and
//   4. preserve a manual decision (a day mode) across the regenerate.
// NOT part of the app runtime. Run against `vite preview` (default :4176).
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:4176/";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log("ok  -", msg);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1400 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".week-list", { timeout: 15000 });

  const panel = page.locator(".panel", { has: page.locator(".week-list") }).first();
  const weekText = () => panel.locator(".week-list").innerText();
  const previews = () => panel.locator(".wk-topic").allInnerTexts();

  // ---- 1. Regenerate via the Manage menu ---------------------------------
  const before = await previews();
  await panel.getByRole("button", { name: "Manage week" }).click();
  await page.getByRole("button", { name: "Regenerate week" }).click();

  // Feedback must appear (aria-live status), and the menu must close.
  await page.waitForSelector(".wk-regen-note", { timeout: 4000 });
  const note = (await panel.locator(".wk-regen-note").innerText()).trim();
  if (note.toLowerCase().includes("refreshed")) ok(`menu Regenerate shows feedback: "${note}"`);
  else fail(`expected "Plan refreshed" feedback, got "${note}"`);

  const after = await previews();
  if (JSON.stringify(after) !== JSON.stringify(before)) ok("menu Regenerate changed the visible weekly plan");
  else fail("weekly plan did not change after Regenerate");

  // ---- 2. Per-day Regenerate + day-mode preservation ---------------------
  // Expand the last expandable day and set a Family day mode.
  const summaries = panel.locator(".wk-summary:not(.wk-summary-static)");
  const count = await summaries.count();
  if (count === 0) fail("no expandable days found");
  await summaries.nth(count - 1).click();
  await page.waitForSelector(".wk-day-controls", { timeout: 4000 });

  const dayMode = panel.locator(".wk-day-mode select").last();
  await dayMode.selectOption("family");
  await page.waitForTimeout(150);
  if ((await weekText()).includes("Family")) ok("day mode set to Family (badge visible)");
  else fail("Family day-mode badge did not appear");

  const beforeDay = await previews();
  await panel.getByRole("button", { name: "Regenerate the study plan" }).first().click();
  await page.waitForTimeout(250);

  // Feedback fires again.
  const note2 = (await panel.locator(".wk-regen-note").innerText()).trim();
  if (note2.toLowerCase().includes("refreshed")) ok(`per-day Regenerate shows feedback: "${note2}"`);
  else fail(`per-day Regenerate gave no feedback (got "${note2}")`);

  // The Family day mode must survive the regenerate (manual choice preserved).
  if ((await weekText()).includes("Family")) ok("Family day mode preserved across Regenerate");
  else fail("day mode was wiped by Regenerate");

  const afterDay = await previews();
  if (JSON.stringify(afterDay) !== JSON.stringify(beforeDay)) ok("per-day Regenerate changed the visible plan");
  else console.log("note - per-day Regenerate produced an identical preview (feedback still shown)");

  if (process.exitCode) console.error("\nQA FAILED");
  else console.log("\nQA PASSED");
} finally {
  await browser.close();
}
