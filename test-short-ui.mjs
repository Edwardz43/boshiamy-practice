import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const BASE = "http://127.0.0.1:4180/";
const OUT = path.resolve("mobile-shots");
fs.mkdirSync(OUT, { recursive: true });

const appSrc = fs.readFileSync("src/App.tsx", "utf8");
const m = appSrc.match(/const CHARS: CharItem\[\] = (\[.*?\]);/);
assert.ok(m, "CHARS array not found in src/App.tsx");
const CHARS = JSON.parse(m[1]);
const byChar = new Map(CHARS.map((x) => [x.c, x]));
const shortCodeOf = (ch) => byChar.get(ch).k.find((x) => x.length <= 2);
const fullCodeOf = (ch) => byChar.get(ch).k.find((x) => x.length >= 3);

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const errs = [];
const cspViolations = [];

function hook(p) {
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  p.on("console", (msg) => {
    if (msg.type() === "error") errs.push("CONSOLE " + msg.text());
  });
}

async function runView(name, ctxOpts, scheme) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme: scheme });
  await ctx.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push({
        effectiveDirective: e.effectiveDirective,
        blockedURI: e.blockedURI,
      });
    });
  });
  const p = await ctx.newPage();
  hook(p);
  await p.goto(BASE, { waitUntil: "networkidle" });
  const mobile = !!ctxOpts.isMobile;

  if (mobile) {
    await p.click(".gear-btn");
    await p.click('.settings-chip:has-text("簡碼練習")');
    await p.click(".sheet-close");
  } else {
    await p.keyboard.press("Alt+Digit7");
  }

  await p.waitForSelector('[data-testid="short-stage"]');
  await p.waitForSelector('[data-testid="short-glyph"]');
  const sw0 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sw0 <= 2, name + " initial horizontal overflow: " + sw0);

  // 1) Full code submitted -> coaching message, marked wrong
  const g1 = (await p.locator('[data-testid="short-glyph"]').textContent()).trim();
  const fc1 = fullCodeOf(g1);
  assert.ok(fc1, "expected full code for " + g1);
  if (mobile) {
    await p.keyboard.type(fc1);
    await p.click('.os-action.is-primary');
  } else {
    await p.fill('input[aria-label="嘸蝦米簡碼"]', fc1);
    await p.keyboard.press("Enter");
  }
  await p.waitForSelector('[data-testid="short-feedback"]');
  const fb1 = await p.locator('[data-testid="short-feedback"]').innerText();
  assert.match(fb1, /這是全碼/);

  // Advance to next question
  if (mobile) {
    await p.click('.os-action.is-primary');
  } else {
    await p.keyboard.press("Enter");
  }
  await p.waitForFunction(() => !document.querySelector('[data-testid="short-feedback"]'));

  // 2) Hint works and doesn't leak 1-key letter, then short code succeeds
  const g2 = (await p.locator('[data-testid="short-glyph"]').textContent()).trim();
  const sc2 = shortCodeOf(g2);
  assert.ok(sc2, "expected short code for " + g2);
  if (mobile) {
    await p.click('.os-action:has-text("提示")');
  } else {
    await p.keyboard.press("/");
  }
  await p.waitForSelector('[data-testid="short-hint"]');
  const hintTxt = await p.locator('[data-testid="short-hint"]').innerText();
  assert.match(hintTxt, /一碼簡碼/);
  assert.ok(!hintTxt.includes(sc2.toUpperCase()), "1-key hint leaked letter: " + hintTxt);

  if (mobile) {
    await p.keyboard.type(sc2);
    await p.click('.os-action.is-primary');
  } else {
    await p.fill('input[aria-label="嘸蝦米簡碼"]', sc2);
    await p.keyboard.press("Enter");
  }
  await p.waitForSelector('[data-testid="short-feedback"]');
  const fb2 = await p.locator('[data-testid="short-feedback"]').innerText();
  assert.match(fb2, /答對了/);

  // 3) Check localStorage history recorded short attempts
  const today = await p.evaluate(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  });
  const hist = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-practice-history-v1") || "{}"));
  assert.ok((hist.days?.[today]?.short?.tried ?? 0) >= 2, name + " missing short tried count");
  assert.ok((hist.days?.[today]?.short?.ok ?? 0) >= 1, name + " missing short ok count");

  // 4) Open short-code cheat sheet and verify 15 cards & no overflow
  if (mobile) {
    await p.click(".gear-btn");
    await p.click('[data-testid="short-table-toggle"]');
    await p.waitForSelector('[data-testid="short-table-sheet"]');
  } else {
    await p.click('[data-testid="short-table-toggle"]');
  }
  await p.waitForSelector('[data-testid="short-table"]');
  const cardCount = await p.locator('[data-testid="short-table"] .short-table-card').count();
  assert.equal(cardCount, 15, name + " expected 15 one-key cards");
  const sw1 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sw1 <= 2, name + " table horizontal overflow: " + sw1);
  await p.screenshot({ path: path.join(OUT, `short-${name}.png`), fullPage: !mobile });

  if (mobile) {
    await p.click('[data-testid="short-table-sheet"] .sheet-close');
  } else {
    await p.keyboard.press("Alt+KeyJ");
  }
  await p.waitForFunction(() => !document.querySelector('[data-testid="short-table"]'));

  // 5) Switch across tiers cleanly
  for (const tier of ["two100", "two300", "all"]) {
    if (mobile) {
      await p.click(".gear-btn");
      await p.click(`[data-testid="short-tier-${tier}"]`);
      await p.click(".sheet-close");
    } else {
      await p.click(`[data-testid="short-tier-${tier}"]`);
    }
    await p.waitForSelector('[data-testid="short-glyph"]');
  }

  // 6) Verify 紀錄 mode "簡碼" filter
  if (mobile) {
    await p.click(".gear-btn");
    await p.click('.settings-chip:has-text("紀錄")');
    await p.click(".sheet-close");
  } else {
    await p.keyboard.press("Alt+Digit6");
  }
  await p.waitForSelector('[data-testid="history-filter-short"]');
  await p.click('[data-testid="history-filter-short"]');
  const summary = await p.locator('[data-testid="history-summary"]').innerText();
  assert.match(summary, /50%/);

  const v = await p.evaluate(() => window.__cspViolations || []);
  cspViolations.push(...v);
  await ctx.close();
  console.log(name, "short UI ok");
}

await runView("desktop-light", { viewport: { width: 1280, height: 900 } }, "light");
await runView("desktop-dark", { viewport: { width: 1280, height: 900 } }, "dark");
await runView("mobile-light", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "light");
await runView("mobile-dark", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "dark");

await browser.close();
assert.equal(cspViolations.length, 0, "CSP violations: " + JSON.stringify(cspViolations));
assert.equal(errs.length, 0, "Browser errors: " + errs.join(" | "));
console.log("SHORT UI ALL OK");
