// Run with preview server on http://127.0.0.1:4180/
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = "http://127.0.0.1:4180/";

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

async function runView(name, ctxOpts) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW" });
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

  // ---- Part A: Lookup Wordbook bookmarking + dedicated practice ----
  if (mobile) {
    await p.click('[data-testid="mobile-mode-chip-lookup"]');
  } else {
    await p.keyboard.press("Alt+Digit5");
  }
  await p.waitForSelector('[data-testid="lookup-input"]');
  await p.fill('[data-testid="lookup-input"]', "電腦");
  await p.waitForSelector('[data-testid="lookup-star-btn"]');

  // Star first char ("電")
  await p.click('[data-testid="lookup-star-btn"][data-char="電"]');
  assert.equal(await p.textContent('[data-testid="wordbook-count"]'), "1 字", name + ": count should be 1");

  // Star all remaining ("腦")
  await p.click('[data-testid="lookup-star-all"]');
  assert.equal(await p.textContent('[data-testid="wordbook-count"]'), "2 字", name + ": count should be 2");

  // Verify persistence after reload
  await p.reload({ waitUntil: "networkidle" });
  if (mobile) {
    await p.click('[data-testid="mobile-mode-chip-lookup"]');
  } else {
    await p.keyboard.press("Alt+Digit5");
  }
  await p.waitForSelector('[data-testid="wordbook-panel"]');
  assert.equal(await p.textContent('[data-testid="wordbook-count"]'), "2 字", name + ": wordbook should persist");

  // Open Wordbook Practice
  await p.click('[data-testid="wordbook-practice-btn"]');
  await p.waitForSelector('[data-testid="wordbook-practice-stage"]');
  const wbAns = await p.getAttribute('[data-testid="wordbook-practice-stage"]', "data-answer");
  assert.ok(wbAns && wbAns.length > 0, name + ": wordbook practice should have answer");

  // Submit correct answer
  if (mobile) {
    for (const ch of wbAns) await p.keyboard.press(ch);
    await p.keyboard.press("Enter");
  } else {
    await p.fill('[data-testid="wordbook-input"]', wbAns);
    await p.keyboard.press("Enter");
  }
  await p.waitForSelector('[data-testid="wordbook-feedback-ok"]');

  // Mark current word mastered (remove from wordbook)
  await p.click('[data-testid="wordbook-remove-cur-btn"]');
  await p.click('[data-testid="wordbook-back-btn"]');
  await p.waitForSelector('[data-testid="wordbook-count"]');
  assert.equal(await p.textContent('[data-testid="wordbook-count"]'), "1 字", name + ": removing mastered word leaves 1");

  // ---- Part B: Phrase / Idiom continuous mode ----
  if (mobile) {
    await p.click('[data-testid="mobile-mode-chip-phrases"]');
  } else {
    await p.keyboard.press("Alt+Digit8");
  }
  await p.waitForSelector('[data-testid="phrase-stage"]');

  // Switch to idiom category
  await p.click('[data-testid="phrase-cat-idiom"]');
  await p.waitForTimeout(80);
  const idiomText = await p.getAttribute('[data-testid="phrase-stage"]', "data-phrase");
  assert.equal(Array.from(idiomText ?? "").length, 4, name + ": idiom should be 4 chars, got " + idiomText);

  // Wrong code shows feedback
  if (mobile) {
    await p.keyboard.type("zzzz");
    await p.keyboard.press("Enter");
  } else {
    await p.fill('[data-testid="phrase-input"]', "zzzz");
    await p.keyboard.press("Enter");
  }
  await p.waitForSelector('[data-testid="phrase-bad-feedback"]');

  // Clear wrong input and type all 4 characters of the idiom correctly
  if (mobile) {
    for (let k = 0; k < 4; k++) await p.keyboard.press("Backspace");
  }
  for (let i = 0; i < 4; i++) {
    const code = await p.getAttribute('[data-testid="phrase-stage"]', "data-answer");
    assert.ok(code && code.length > 0, name + ": missing phrase char code at " + i);
    if (mobile) {
      for (const ch of code) await p.keyboard.press(ch);
      await p.keyboard.press("Enter");
    } else {
      await p.fill('[data-testid="phrase-input"]', code);
      await p.keyboard.press(" ");
    }
    await p.waitForTimeout(40);
  }
  const nextIdiom = await p.getAttribute('[data-testid="phrase-stage"]', "data-phrase");
  assert.notEqual(nextIdiom, idiomText, name + ": should advance to next phrase after completing all 4 chars");

  // Check horizontal overflow
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sw <= 1, name + ": horizontal overflow detected: " + sw);

  const viols = await p.evaluate(() => window.__cspViolations || []);
  cspViolations.push(...viols);
  await ctx.close();
}

try {
  await runView("desktop", { viewport: { width: 1280, height: 820 } });
  await runView("mobile", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
} finally {
  await browser.close();
}

assert.equal(errs.length, 0, "Runtime errors: " + errs.join("\n"));
assert.equal(cspViolations.length, 0, "CSP violations: " + JSON.stringify(cspViolations));
console.log("test-wordbook-phrases-ui: ALL PASSED (desktop + mobile)");
