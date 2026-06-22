// Dev-only visual QA for the Gentle reminder relocation. Captures the upper
// dashboard at desktop / tablet / mobile (light + dark) and asserts that the
// reminder sits in the upper grid (right column, .db-side) and NOT in the lower
// metrics row (.stat-grid). NOT part of the app runtime. Run against vite preview.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:4176/";
const OUT = ".qa";
mkdirSync(OUT, { recursive: true });

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log("ok  -", msg);
}

const browser = await chromium.launch();
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 1000 },
      colorScheme: theme === "dark" ? "dark" : "light",
    });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".dash-grid", { timeout: 15000 });

    // Structural assertions (run once, on the first theme).
    if (theme === "light") {
      const reminderInSide = await page.locator(".db-side .reminder-card").count();
      if (reminderInSide === 1) ok("Gentle reminder is in the upper right column (.db-side)");
      else fail(`expected reminder in .db-side, found ${reminderInSide}`);

      const examAboveReminder = await page.evaluate(() => {
        const side = document.querySelector(".db-side");
        if (!side) return false;
        const kids = [...side.children];
        const exam = kids.findIndex((n) => n.classList.contains("exam-card"));
        const rem = kids.findIndex((n) => n.classList.contains("reminder-card"));
        return exam >= 0 && rem >= 0 && exam < rem;
      });
      if (examAboveReminder) ok("Exam date sits above the reminder in the stack");
      else fail("exam/reminder order is wrong in the side column");

      const reminderInStats = await page.locator(".stat-grid .reminder-card, .stat-grid .stat--motivation").count();
      if (reminderInStats === 0) ok("Lower metrics row has no reminder card");
      else fail(`reminder still present in .stat-grid (${reminderInStats})`);

      const statCount = await page.locator(".stat-grid .stat").count();
      if (statCount === 5) ok("Lower metrics row has exactly 5 stat cards");
      else fail(`expected 5 stat cards, found ${statCount}`);

      // No horizontal overflow at desktop width.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (!overflow) ok("no horizontal overflow at 1366px");
      else fail("horizontal overflow at desktop width");
    }

    await page.screenshot({ path: `${OUT}/dashboard-desktop-${theme}.png` });

    // Tablet.
    await page.setViewportSize({ width: 900, height: 1100 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/dashboard-tablet-${theme}.png` });

    // Mobile.
    await page.setViewportSize({ width: 390, height: 1300 });
    await page.waitForTimeout(150);
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (theme === "light") {
      if (!mobileOverflow) ok("no horizontal overflow at 390px (mobile)");
      else fail("horizontal overflow at mobile width");
    }
    await page.screenshot({ path: `${OUT}/dashboard-mobile-${theme}.png` });

    await context.close();
  }

  if (process.exitCode) console.error("\nQA FAILED");
  else console.log("\nQA PASSED - screenshots in .qa/");
} finally {
  await browser.close();
}
