// Dev-only visual QA for the Charts section after adding "Section coverage".
// Confirms the previously empty bottom-right cell is filled, in dark + light and
// on mobile. Seeds a few done topics so the coverage bars are visible.
// NOT part of the app runtime. Run against `vite preview` (default :4176).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../../docs/analysis_output/ui_review");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL || "http://localhost:4176/";

const SHOTS = [
  { name: "charts_1366_dark", theme: "dark", w: 1366, h: 1500 },
  { name: "charts_1366_light", theme: "light", w: 1366, h: 1500 },
  { name: "charts_390_dark", theme: "dark", w: 390, h: 2200, mobile: true },
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
    await page.waitForSelector(".charts-grid", { timeout: 15000 });

    // Mark a couple of topics done via the Topics table so coverage bars show
    // real progress (best-effort; the chart still renders with zero progress).
    try {
      await page.getByRole("button", { name: "Topics" }).first().click();
      await page.waitForTimeout(300);
      const doneButtons = page.getByRole("button", { name: /mark .* done|Mark done/i });
      const n = Math.min(3, await doneButtons.count());
      for (let i = 0; i < n; i++) await doneButtons.nth(i).click();
      await page.getByRole("button", { name: "Dashboard" }).first().click();
      await page.waitForTimeout(300);
      await page.waitForSelector(".charts-grid", { timeout: 8000 });
    } catch {}

    const charts = page.locator(".charts").first();
    await charts.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700); // let the bar-grow animation settle
    await charts.screenshot({ path: resolve(OUT, `${s.name}.png`) });
    console.log("saved", s.name);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log("done ->", OUT);
