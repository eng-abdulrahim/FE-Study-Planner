// Dev-only visual QA helper. Captures the Dashboard and Topics pages at several
// widths in light/dark, plus the collapsed sidebar and mobile drawer.
// NOT part of the app runtime.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../../docs/analysis_output/ui_review");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL || "http://localhost:4173/";

const SHOTS = [
  { name: "dash_390_light", page: "dashboard", theme: "light", w: 390, h: 1750 },
  { name: "dash_768_light", page: "dashboard", theme: "light", w: 768, h: 1500 },
  { name: "dash_1366_light", page: "dashboard", theme: "light", w: 1366, h: 1280 },
  { name: "dash_1440_light", page: "dashboard", theme: "light", w: 1440, h: 1280 },
  { name: "dash_1366_collapsed_light", page: "dashboard", theme: "light", w: 1366, h: 1280, variant: "collapsed" },
  { name: "dash_390_drawer_light", page: "dashboard", theme: "light", w: 390, h: 844, variant: "drawer" },
  { name: "dash_390_dark", page: "dashboard", theme: "dark", w: 390, h: 1750 },
  { name: "dash_1366_dark", page: "dashboard", theme: "dark", w: 1366, h: 1280 },
  { name: "topics_390_light", page: "topics", theme: "light", w: 390, h: 950 },
  { name: "topics_768_light", page: "topics", theme: "light", w: 768, h: 1050 },
  { name: "topics_1366_light", page: "topics", theme: "light", w: 1366, h: 1000 },
  { name: "topics_1440_light", page: "topics", theme: "light", w: 1440, h: 1000 },
  { name: "topics_390_dark", page: "topics", theme: "dark", w: 390, h: 950 },
];

const browser = await chromium.launch();
try {
  for (const s of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: 1,
      colorScheme: s.theme,
    });
    await context.addInitScript((theme) => {
      try {
        localStorage.setItem("latifah-fe-theme", theme);
      } catch {}
    }, s.theme);
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForSelector(".dash-grid", { timeout: 15000 });
    const isMobile = s.w <= 900;

    if (s.page === "topics") {
      if (isMobile) {
        await page.click(".icon-btn");
        await page.waitForTimeout(250);
      }
      await page.getByRole("button", { name: "Topics", exact: true }).click();
      await page.waitForSelector(".topics-table", { timeout: 15000 });
    }

    if (s.variant === "collapsed") {
      await page.click(".side-collapse-btn"); // collapse desktop sidebar (button lives in sidebar)
      await page.waitForTimeout(300);
    }
    if (s.variant === "drawer") {
      await page.click(".icon-btn"); // open mobile drawer (header menu button)
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(OUT, `${s.name}.png`), fullPage: false });
    console.log("saved", s.name);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log("done ->", OUT);
