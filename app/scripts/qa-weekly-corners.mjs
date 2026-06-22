// Dev-only visual QA for the "This week" panel rounded bottom corners.
// Captures the weekly panel (element screenshot, so the page background shows
// through the rounded corners) in dark + light, collapsed and with the last
// expandable day open - the case where row/expand backgrounds used to bleed
// into square corners. NOT part of the app runtime.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../../docs/analysis_output/ui_review");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL || "http://localhost:4176/";

const SHOTS = [
  { name: "weekly_corners_1366_dark", theme: "dark", w: 1366, h: 1400, expandLast: false },
  { name: "weekly_corners_1366_dark_expanded", theme: "dark", w: 1366, h: 1400, expandLast: true },
  { name: "weekly_corners_1366_light_expanded", theme: "light", w: 1366, h: 1400, expandLast: true },
  { name: "weekly_corners_390_dark_expanded", theme: "dark", w: 390, h: 1800, expandLast: true },
  // Hover the LAST row so a full-bleed hover background sits at the card bottom:
  // the exact case where the corners used to go square.
  { name: "weekly_corners_1366_dark_hoverlast", theme: "dark", w: 1366, h: 1400, hoverLast: true },
  { name: "weekly_corners_1366_dark_expanded_hover", theme: "dark", w: 1366, h: 1400, expandLast: true, hoverLast: true },
  // Decisive proof: force a bright full-bleed background on the last row so the
  // bottom-corner clipping is unmistakable (collapsed + expanded).
  { name: "weekly_corners_proof_collapsed", theme: "dark", w: 1366, h: 1400, forceColorLast: true },
  { name: "weekly_corners_proof_expanded", theme: "dark", w: 1366, h: 1400, expandLast: true, forceColorLast: true },
];

const browser = await chromium.launch();
try {
  for (const s of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: 2,
      colorScheme: s.theme,
    });
    await context.addInitScript((theme) => {
      try {
        localStorage.setItem("latifah-fe-theme", theme);
      } catch {}
    }, s.theme);
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForSelector(".week-list", { timeout: 15000 });

    const panel = page.locator(".panel", { has: page.locator(".week-list") }).first();

    const rows = panel.locator(".wk-row");
    const lastRow = rows.last();

    if (s.expandLast) {
      // Open the LAST expandable day so the expanded body sits at the card bottom.
      const summaries = panel.locator(".wk-summary:not(.wk-summary-static)");
      const count = await summaries.count();
      if (count > 0) {
        await summaries.nth(count - 1).click();
        await page.waitForTimeout(350); // let the background/expand transition settle
      }
    }

    await panel.scrollIntoViewIfNeeded();
    if (s.hoverLast) {
      await lastRow.hover();
      await page.waitForTimeout(250); // let the hover background transition settle
    }
    if (s.forceColorLast) {
      // Paint the last row bright magenta to make the corner clipping obvious.
      await lastRow.evaluate((el) => {
        el.style.background = "#ff2d9b";
        el.style.color = "#fff";
      });
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(200);
    await panel.screenshot({ path: resolve(OUT, `${s.name}.png`) });
    console.log("saved", s.name);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log("done ->", OUT);
