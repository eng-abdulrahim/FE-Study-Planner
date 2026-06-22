// Dev-only end-to-end QA for the top summary cards. Verifies that the canonical
// model.summary drives the cards and that they update LIVE (no refresh) when the
// user marks today Done and then Undoes it:
//   - Completed hours increase on Done, return on Undo
//   - Remaining hours decrease on Done, return on Undo
//   - "This week" progress moves on Done, returns on Undo
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

/** Read a stat card by its exact label -> { value, sub }. */
async function stat(page, label) {
  const card = page
    .locator(".stat", { has: page.locator(".stat-label", { hasText: new RegExp(`^${label}$`) }) })
    .first();
  const value = (await card.locator(".stat-value").innerText()).trim();
  const sub = (await card.locator(".stat-sub").innerText()).trim();
  return { value, sub };
}

const hours = (s) => parseFloat(String(s).replace(/[^0-9.]/g, "")) || 0;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1200 } });
  const page = await context.newPage();
  await context.clearCookies();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".stat-grid", { timeout: 15000 });

  const markDone = page.getByRole("button", { name: "Mark Done" }).first();
  if ((await markDone.count()) === 0) {
    fail("no 'Mark Done' button on the Today card (today may be a rest day)");
    throw new Error("cannot run QA without a study day");
  }

  // ---- baseline ----------------------------------------------------------
  const c0 = await stat(page, "Completed");
  const r0 = await stat(page, "Remaining");
  const w0 = await stat(page, "This week");
  const p0 = await stat(page, "Preparation");
  console.log("baseline:", { completed: c0.value, remaining: r0.value, week: `${w0.value} (${w0.sub})`, prep: p0.value });

  // ---- mark today Done ---------------------------------------------------
  await markDone.click();
  await page.getByRole("button", { name: "Undo Done" }).first().waitFor({ timeout: 5000 });

  const c1 = await stat(page, "Completed");
  const r1 = await stat(page, "Remaining");
  const w1 = await stat(page, "This week");
  const p1 = await stat(page, "Preparation");
  console.log("after Done:", { completed: c1.value, remaining: r1.value, week: `${w1.value} (${w1.sub})`, prep: p1.value });

  if (hours(c1.value) > hours(c0.value)) ok(`Completed increased ${c0.value} -> ${c1.value}`);
  else fail(`Completed did not increase (${c0.value} -> ${c1.value})`);

  if (hours(r1.value) < hours(r0.value)) ok(`Remaining decreased ${r0.value} -> ${r1.value}`);
  else fail(`Remaining did not decrease (${r0.value} -> ${r1.value})`);

  if (w1.value !== w0.value || w1.sub !== w0.sub) ok(`This week moved ${w0.value}/${w0.sub} -> ${w1.value}/${w1.sub}`);
  else fail(`This week did not change (${w0.value} ${w0.sub})`);

  if (parseInt(p1.value) >= parseInt(p0.value)) ok(`Preparation did not regress ${p0.value} -> ${p1.value}`);
  else fail(`Preparation regressed ${p0.value} -> ${p1.value}`);

  // ---- undo --------------------------------------------------------------
  await page.getByRole("button", { name: "Undo Done" }).first().click();
  await page.getByRole("button", { name: "Mark Done" }).first().waitFor({ timeout: 5000 });

  const c2 = await stat(page, "Completed");
  const r2 = await stat(page, "Remaining");
  const w2 = await stat(page, "This week");
  console.log("after Undo:", { completed: c2.value, remaining: r2.value, week: `${w2.value} (${w2.sub})` });

  if (c2.value === c0.value) ok(`Completed reverted to ${c0.value}`);
  else fail(`Completed did not revert (${c0.value} -> ${c2.value})`);

  if (r2.value === r0.value) ok(`Remaining reverted to ${r0.value}`);
  else fail(`Remaining did not revert (${r0.value} -> ${r2.value})`);

  if (w2.value === w0.value && w2.sub === w0.sub) ok(`This week reverted to ${w0.value} (${w0.sub})`);
  else fail(`This week did not revert (${w0.value}/${w0.sub} -> ${w2.value}/${w2.sub})`);

  if (process.exitCode) console.error("\nQA FAILED");
  else console.log("\nQA PASSED");
} finally {
  await browser.close();
}
