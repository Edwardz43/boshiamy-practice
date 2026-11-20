// Run against vite preview on http://127.0.0.1:4180/
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = "http://127.0.0.1:4180/";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const consoleErrs = [];
const pageErrs = [];

const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "zh-TW",
  colorScheme: "light",
  acceptDownloads: true,
});
await ctx.addInitScript(() => {
  window.__cspViolations = [];
  document.addEventListener("securitypolicyviolation", (e) => {
    window.__cspViolations.push({
      effectiveDirective: e.effectiveDirective,
      violatedDirective: e.violatedDirective,
      blockedURI: e.blockedURI,
      sourceFile: e.sourceFile,
      lineNumber: e.lineNumber,
      sample: e.sample,
    });
  });
});

const p = await ctx.newPage();
p.on("pageerror", (e) => pageErrs.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") consoleErrs.push(m.text());
});

await p.goto(BASE, { waitUntil: "networkidle" });
const cspMeta = await p.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
assert.ok(cspMeta && cspMeta.includes("default-src 'self'"), "CSP meta missing in served index.html");
assert.ok(cspMeta.includes("https://zh.wikipedia.org"), "CSP missing Wikipedia connect-src");

// 字根
await p.keyboard.press("Alt+Digit1");
await p.waitForSelector('[role=tab][aria-selected="true"]:has-text("字根")', { timeout: 10000 });
await p.waitForTimeout(300);

// 常用字
await p.keyboard.press("Alt+Digit2");
await p.waitForSelector('[role=tab][aria-selected="true"]:has-text("常用字")', { timeout: 10000 });
await p.waitForTimeout(300);

// 限時
await p.keyboard.press("Alt+Digit3");
await p.waitForSelector('[role=tab][aria-selected="true"]:has-text("限時")', { timeout: 10000 });
await p.waitForTimeout(300);

// 文章 — Wikipedia fetch must still work
await p.keyboard.press("Alt+Digit4");
await p.waitForSelector('[data-testid="article-passage"]', { timeout: 30000 });
const title = (await p.locator(".article-title a").textContent())?.trim() || "";
const href = await p.locator(".article-title a").getAttribute("href");
assert.ok(title.length > 0, "article title missing (Wikipedia fetch may have failed)");
assert.ok(href && href.includes("zh.wikipedia.org"), "article link is not Wikipedia: " + href);
console.log("article ok:", title);

// 查碼
await p.keyboard.press("Alt+Digit5");
await p.waitForSelector('[data-testid="lookup-desktop"]', { timeout: 15000 });
await p.fill('[data-testid="lookup-input"]', "的");
await p.waitForSelector('[data-testid="lookup-results"]', { timeout: 10000 });
console.log("lookup ok");

// 紀錄 — export + import (normal and oversize)
await p.keyboard.press("Alt+Digit6");
await p.waitForSelector('[data-testid="history-root"]', { timeout: 15000 });

const [download] = await Promise.all([
  p.waitForEvent("download", { timeout: 10000 }),
  p.click('[data-testid="history-export"]'),
]);
const tmp = "/tmp/csp-backup.json";
await download.saveAs(tmp);
const exported = JSON.parse(fs.readFileSync(tmp, "utf8"));
assert.equal(exported.version, 1);
assert.ok(exported.stats && exported.history);
console.log("export ok", download.suggestedFilename());

const small = {
  version: 1,
  exportedAt: "2026-11-19T00:00:00.000Z",
  stats: { ok: 2, tried: 3, streak: 1, missChars: { 我: 1 }, missRoots: { "a:日": 1 } },
  history: { days: { "2026-11-19": { date: "2026-11-19", roots: { tried: 3, ok: 2, ms: 3000 } } } },
  settings: { autoNext: false },
};
await p.locator('[data-testid="history-import-input"]').setInputFiles({
  name: "ok.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(small)),
});
await p.waitForSelector('[data-testid="history-import-panel"]');
await p.click('[data-testid="history-import-replace"]');
await p.waitForSelector('[data-testid="history-msg"]');
console.log("import ok");

await p.locator('[data-testid="history-import-input"]').setInputFiles({
  name: "too-big.json",
  mimeType: "application/json",
  buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 0x41),
});
await p.waitForSelector('[data-testid="history-err"]');
const errText = (await p.locator('[data-testid="history-err"]').textContent()) || "";
assert.match(errText, /2 MB/);
console.log("oversize import rejected");

// Service worker still registers
const sw = await p.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return { supported: false };
  const ready = await Promise.race([
    navigator.serviceWorker.ready.then((r) => ({
      supported: true,
      scope: r.scope,
      scriptURL: r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "",
    })),
    new Promise((resolve) => setTimeout(() => resolve({ supported: true, timeout: true }), 15000)),
  ]);
  const regs = await navigator.serviceWorker.getRegistrations();
  return { ...ready, count: regs.length };
});
assert.equal(sw.supported, true);
assert.ok(!sw.timeout, "service worker ready timed out");
assert.ok(sw.count >= 1, "no service worker registration");
assert.match(sw.scriptURL || "", /sw\.js/);
console.log("sw ok", sw.scriptURL);

const violations = await p.evaluate(() => window.__cspViolations || []);
if (violations.length || consoleErrs.length || pageErrs.length) {
  console.error("CSP violations:", JSON.stringify(violations, null, 2));
  console.error("console errors:", consoleErrs);
  console.error("page errors:", pageErrs);
}
assert.equal(violations.length, 0, "CSP violations: " + JSON.stringify(violations));
assert.equal(pageErrs.length, 0, "page errors: " + pageErrs.join(" | "));
assert.equal(consoleErrs.length, 0, "console errors: " + consoleErrs.join(" | "));

await browser.close();
console.log("CSP ALL OK");
