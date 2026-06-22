// Dev-only visual QA for the mobile Exam-date card overflow fix. For each
// narrow viewport (light + dark) it asserts:
//   1. no horizontal PAGE scroll (documentElement.scrollWidth <= innerWidth),
//   2. the date <input> stays fully inside the .exam-card border box - both at
//      rest and while focused (the focus ring must not cross the card edge).
// It also screenshots the card so the wrap/stack can be eyeballed.
//
// NOT part of the app runtime. Build first, serve the dist, then run:
//   npm run build
//   npx vite preview --port 4176 &
//   node scripts/qa-exam-date-mobile.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:4176/";
const OUT = ".qa";
const WIDTHS = [430, 390, 375, 360, 320];
mkdirSync(OUT, { recursive: true });

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log("ok  -", msg);
}

// Geometry: the input (incl. its 3px focus ring) must sit within the card box.
async function assertInside(page, width, theme, label) {
  const r = await page.evaluate(() => {
    const card = document.querySelector(".exam-card");
    const input = document.querySelector(".exam-edit input");
    if (!card || !input) return null;
    const c = card.getBoundingClientRect();
    const i = input.getBoundingClientRect();
    return { cLeft: c.left, cRight: c.right, iLeft: i.left, iRight: i.right };
  });
  if (!r) return fail(`${width}px ${theme} ${label}: card/input not found`);
  // Allow 1px of sub-pixel rounding slack on each side.
  const insideLeft = r.iLeft >= r.cLeft - 1;
  const insideRight = r.iRight <= r.cRight + 1;
  if (insideLeft && insideRight) {
    ok(`${width}px ${theme} ${label}: input within card (overhang R ${(r.iRight - r.cRight).toFixed(1)}px)`);
  } else {
    fail(`${width}px ${theme} ${label}: input escapes card (L ${(r.iLeft - r.cLeft).toFixed(1)}, R ${(r.iRight - r.cRight).toFixed(1)})`);
  }
}

const browser = await chromium.launch();
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 430, height: 1300 },
      colorScheme: theme === "dark" ? "dark" : "light",
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".exam-card", { timeout: 15000 });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 1300 });
      await page.waitForTimeout(120);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      if (!overflow) ok(`${width}px ${theme}: no horizontal page scroll`);
      else fail(`${width}px ${theme}: horizontal page scroll present`);

      // At rest.
      await assertInside(page, width, theme, "rest");

      // While focused (simulates "Change exam date" interaction + focus ring).
      await page.locator(".exam-edit input").focus();
      await page.waitForTimeout(80);
      await assertInside(page, width, theme, "focused");
      await page.locator(".exam-edit input").evaluate((el) => el.blur());

      const card = await page.locator(".exam-card").boundingBox();
      if (card) {
        await page.screenshot({
          path: `${OUT}/exam-date-${width}-${theme}.png`,
          clip: {
            x: Math.max(0, card.x - 4),
            y: Math.max(0, card.y - 4),
            width: Math.min(width, card.width + 8),
            height: card.height + 8,
          },
        });
      }
    }

    await context.close();
  }

  if (process.exitCode) console.error("\nEXAM-DATE MOBILE QA FAILED");
  else console.log("\nEXAM-DATE MOBILE QA PASSED - screenshots in .qa/");
} finally {
  await browser.close();
}
