import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const BASE = "http://127.0.0.1:4180/";
const OUT = path.resolve("mobile-shots");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const errs = [];
const cspViolations = [];

function hook(p) {
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errs.push("CONSOLE " + m.text());
  });
}

async function addCspListener(ctx) {
  await ctx.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push({
        effectiveDirective: e.effectiveDirective,
        blockedURI: e.blockedURI,
      });
    });
  });
}

// 1) Desktop theme switching, hover preview, shortcuts across modes, reload persistence
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-TW",
    colorScheme: "light",
  });
  await addCspListener(ctx);
  const p = await ctx.newPage();
  hook(p);

  await p.goto(BASE, { waitUntil: "networkidle" });
  assert.equal(await p.locator("html").getAttribute("data-theme"), "ink");
  assert.equal(await p.locator("html").getAttribute("data-mode"), "light");

  const sw0 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sw0 <= 0, "desktop ink light horizontal overflow: " + sw0);

  // Verify 7 mode tabs sit on a single row at 1280px without line breaks inside tab text
  const tabRects = await p.$$eval(".mode-tab", (els) =>
    els.map((el) => ({ top: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height) })),
  );
  assert.equal(tabRects.length, 7);
  const tops = new Set(tabRects.map((r) => r.top));
  assert.equal(tops.size, 1, "mode tabs wrapped to multiple rows at 1280px: " + JSON.stringify(tabRects));
  await p.screenshot({ path: path.join(OUT, "theme-ink-light.png"), fullPage: true });

  // Open popover by clicking button, hover preview -> studio, move out -> reverts to ink
  await p.click('[data-testid="theme-picker-btn"]');
  await p.waitForSelector('[data-testid="theme-popover"]');
  assert.equal(await p.locator('[data-testid="theme-popover"] input').count(), 0, "no <input> in theme popover");
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(OUT, "theme-popover-open.png"), fullPage: true });

  await p.hover('[data-testid="theme-option-studio"]');
  assert.equal(await p.locator("html").getAttribute("data-theme"), "studio", "hover should preview studio");

  await p.mouse.move(10, 10);
  await p.waitForTimeout(50);
  assert.equal(await p.locator("html").getAttribute("data-theme"), "ink", "mouse leave should revert preview");

  // Select studio & toggle dark with 1-click button
  await p.click('[data-testid="theme-option-studio"]');
  await p.waitForFunction(() => !document.querySelector('[data-testid="theme-popover"]'));
  assert.equal(await p.locator("html").getAttribute("data-theme"), "studio");

  await p.click('[data-testid="color-mode-btn"]');
  assert.equal(await p.locator("html").getAttribute("data-mode"), "dark");
  const swStudio = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(swStudio <= 0, "desktop studio dark overflow: " + swStudio);
  await p.screenshot({ path: path.join(OUT, "theme-studio-dark.png"), fullPage: true });

  // Alt+P opens popover, Esc closes it
  await p.keyboard.press("Alt+KeyP");
  await p.waitForSelector('[data-testid="theme-popover"]');
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector('[data-testid="theme-popover"]'));

  // Test Alt+P works in lookup, article, and history modes
  await p.keyboard.press("Alt+Digit5");
  await p.waitForSelector('[data-testid="lookup-input"]');
  await p.keyboard.press("Alt+KeyP");
  await p.waitForSelector('[data-testid="theme-popover"]');
  await p.keyboard.press("Alt+KeyP");
  await p.waitForFunction(() => !document.querySelector('[data-testid="theme-popover"]'));

  await p.keyboard.press("Alt+Digit6");
  await p.waitForSelector('[data-testid="history-root"]');
  await p.keyboard.press("Alt+KeyP");
  await p.waitForSelector('[data-testid="theme-popover"]');
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector('[data-testid="theme-popover"]'));

  await p.keyboard.press("Alt+Digit1");
  await p.waitForTimeout(150);

  // Switch to playful + light
  await p.click('[data-testid="theme-picker-btn"]');
  await p.waitForSelector('[data-testid="theme-popover"]');
  await p.click('[data-testid="color-mode-light"]');
  await p.click('[data-testid="theme-option-playful"]');
  assert.equal(await p.locator("html").getAttribute("data-theme"), "playful");
  assert.equal(await p.locator("html").getAttribute("data-mode"), "light");
  const swPlayful = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(swPlayful <= 0, "desktop playful light overflow: " + swPlayful);
  await p.screenshot({ path: path.join(OUT, "theme-playful-light.png"), fullPage: true });

  // Switch to minimal + dark and verify persistence across reload
  await p.click('[data-testid="theme-picker-btn"]');
  await p.waitForSelector('[data-testid="theme-popover"]');
  await p.click('[data-testid="color-mode-dark"]');
  await p.click('[data-testid="theme-option-minimal"]');
  assert.equal(await p.locator("html").getAttribute("data-theme"), "minimal");
  assert.equal(await p.locator("html").getAttribute("data-mode"), "dark");
  const swMin = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(swMin <= 0, "desktop minimal dark overflow: " + swMin);
  await p.screenshot({ path: path.join(OUT, "theme-minimal-dark.png"), fullPage: true });

  await p.reload({ waitUntil: "networkidle" });
  assert.equal(await p.locator("html").getAttribute("data-theme"), "minimal", "theme persisted after reload");
  assert.equal(await p.locator("html").getAttribute("data-mode"), "dark", "color mode persisted after reload");

  cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
  await ctx.close();
  console.log("desktop theme UI ok");
}

// 2) Mobile theme picker inside settings sheet + 0 <input> + reload persistence
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "zh-TW",
    colorScheme: "light",
  });
  await addCspListener(ctx);
  const p = await ctx.newPage();
  hook(p);

  await p.goto(BASE, { waitUntil: "networkidle" });
  assert.equal(await p.locator("input").count(), 0, "mobile page must have 0 <input> elements");

  await p.click(".gear-btn");
  await p.waitForSelector('[data-testid="mobile-theme-section"]');
  assert.equal(await p.locator("input").count(), 0, "mobile settings sheet must have 0 <input> elements");

  await p.click('[data-testid="color-mode-dark"]');
  await p.click('[data-testid="theme-option-studio"]');
  assert.equal(await p.locator("html").getAttribute("data-theme"), "studio");
  assert.equal(await p.locator("html").getAttribute("data-mode"), "dark");
  await p.screenshot({ path: path.join(OUT, "theme-mobile-picker.png") });

  await p.click(".sheet-close");
  const swMob = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(swMob <= 0, "mobile studio dark overflow: " + swMob);

  await p.reload({ waitUntil: "networkidle" });
  assert.equal(await p.locator("html").getAttribute("data-theme"), "studio", "mobile theme persisted after reload");
  assert.equal(await p.locator("html").getAttribute("data-mode"), "dark", "mobile color mode persisted after reload");

  cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
  await ctx.close();
  console.log("mobile theme UI ok");
}

await browser.close();
assert.equal(cspViolations.length, 0, "CSP violations: " + JSON.stringify(cspViolations));
assert.equal(errs.length, 0, "Browser errors: " + errs.join(" | "));
console.log("THEME UI ALL OK");
