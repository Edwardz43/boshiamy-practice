import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
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
function hook(p) {
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errs.push("CONSOLE " + m.text());
  });
}

const SEEDED_HISTORY = {
  days: {
    "2026-11-13": { date: "2026-11-13", roots: { tried: 20, ok: 12, ms: 48000 } },
    "2026-11-14": { date: "2026-11-14", roots: { tried: 18, ok: 13, ms: 36000 }, chars: { tried: 15, ok: 11, ms: 30000 } },
    "2026-11-15": { date: "2026-11-15", chars: { tried: 30, ok: 24, ms: 54000 }, timed: { tried: 20, ok: 16, ms: 60000 } },
    "2026-11-16": { date: "2026-11-16", article: { tried: 80, ok: 70, ms: 180000 } },
    "2026-11-17": { date: "2026-11-17", roots: { tried: 25, ok: 20, ms: 40000 }, chars: { tried: 22, ok: 19, ms: 33000 } },
    "2026-11-18": { date: "2026-11-18", roots: { tried: 16, ok: 14, ms: 24000 }, article: { tried: 60, ok: 54, ms: 120000 } },
    "2026-11-19": { date: "2026-11-19", roots: { tried: 12, ok: 11, ms: 18000 }, chars: { tried: 18, ok: 16, ms: 27000 }, timed: { tried: 14, ok: 12, ms: 60000 } },
  },
};
const SEEDED_STATS = {
  ok: 292,
  tried: 350,
  streak: 4,
  missChars: { 我: 3 },
  missRoots: { "a:日": 2 },
};

async function seed(p, history = SEEDED_HISTORY, stats = SEEDED_STATS, autoNext = false) {
  await p.addInitScript(
    ({ history, stats, autoNext }) => {
      localStorage.setItem("boshiamy-practice-history-v1", JSON.stringify(history));
      localStorage.setItem("boshiamy-practice-stats-v1", JSON.stringify(stats));
      localStorage.setItem("boshiamy-auto-next-v2", autoNext ? "1" : "0");
    },
    { history, stats, autoNext },
  );
}

async function openHistory(p, mobile) {
  if (mobile) {
    await p.click(".gear-btn");
    await p.click('.settings-chip:has-text("紀錄")');
    await p.click(".sheet-close");
  } else {
    await p.click('[role=tab]:has-text("紀錄")');
  }
  await p.waitForSelector('[data-testid="history-root"]');
}

async function readStorage(p) {
  return p.evaluate(() => ({
    stats: JSON.parse(localStorage.getItem("boshiamy-practice-stats-v1") || "null"),
    history: JSON.parse(localStorage.getItem("boshiamy-practice-history-v1") || "null"),
    autoNext: localStorage.getItem("boshiamy-auto-next-v2"),
  }));
}

// 1) Live recording: answering updates today's history without touching seeded keys in this fresh profile
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-TW", colorScheme: "light" });
  const p = await ctx.newPage();
  hook(p);
  await p.goto(BASE);
  await p.waitForTimeout(400);
  const before = await readStorage(p);
  const tried0 = before.stats?.tried ?? 0;
  const today = await p.evaluate(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  });
  assert.equal(before.history?.days?.[today]?.roots?.tried ?? 0, 0);
  for (let i = 0; i < 3; i++) {
    await p.locator("input").first().fill("zz");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(80);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(80);
  }
  const after = await readStorage(p);
  assert.ok(after.history?.days?.[today]?.roots?.tried >= 3, "recorded at least 3 root attempts");
  assert.equal(after.history.days[today].roots.tried, after.stats.tried - tried0);
  assert.ok(after.history.days[today].roots.ms >= 0);
  assert.ok(after.stats.tried >= tried0 + 3, "cumulative stats still update");
  console.log("record ok", today, after.history.days[today], "stats", after.stats.ok, after.stats.tried);
  await ctx.close();
}

// 2) Seeded chart + export/import round-trip on desktop and mobile, light/dark
async function runView(name, ctxOpts, scheme) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme: scheme });
  const p = await ctx.newPage();
  hook(p);
  await seed(p);
  await p.goto(BASE);
  await p.waitForTimeout(400);
  const mobile = !!ctxOpts.isMobile;
  const statsText = await p.locator("body").innerText();
  assert.match(statsText, /292\s*\/\s*350|連對 4/);
  await openHistory(p, mobile);
  await p.waitForSelector('[data-testid="history-chart-volume"]');
  await p.waitForSelector('[data-testid="history-chart-accuracy"]');
  await p.waitForSelector('[data-testid="history-chart-speed"]');
  await p.waitForSelector('[data-testid="history-table"]');
  const table = await p.locator('[data-testid="history-table"]').innerText();
  assert.match(table, /11-19/);
  assert.match(table, /11-16/);
  assert.match(table, /字根/);
  assert.match(table, /文章/);
  const summary = await p.locator('[data-testid="history-summary"]').innerText();
  assert.match(summary, /題數/);
  assert.match(summary, /正確率/);
  await p.click('[data-testid="history-range-30"]');
  await p.waitForTimeout(50);
  await p.click('[data-testid="history-filter-article"]');
  await p.waitForTimeout(50);
  const artSummary = await p.locator('[data-testid="history-summary"]').innerText();
  assert.match(artSummary, /字\/分/);
  await p.click('[data-testid="history-filter-all"]');
  await p.click('[data-testid="history-range-7"]');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sw <= 2, "no horizontal overflow " + sw);
  const shotName = name.includes("desktop") ? `history-${name}.png` : `history-${name}.png`;
  await p.screenshot({ path: path.join(OUT, shotName), fullPage: !mobile });
  console.log(name, "chart ok, overflow", sw);

  // export
  const [download] = await Promise.all([
    p.waitForEvent("download"),
    p.click('[data-testid="history-export"]'),
  ]);
  const dlPath = await download.path();
  const exported = JSON.parse(fs.readFileSync(dlPath, "utf8"));
  assert.equal(exported.version, 1);
  assert.equal(exported.stats.ok, 292);
  assert.equal(exported.history.days["2026-11-19"].chars.tried, 18);
  assert.equal(exported.settings.autoNext, false);
  console.log(name, "export ok", download.suggestedFilename());

  // invalid import
  await p.locator('[data-testid="history-import-input"]').setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{nope"),
  });
  await p.waitForSelector('[data-testid="history-err"]');
  assert.match(await p.locator('[data-testid="history-err"]').innerText(), /JSON|格式|備份/);

  // replace import with a smaller backup
  const smaller = {
    version: 1,
    exportedAt: "2026-11-19T00:00:00.000Z",
    stats: { ok: 1, tried: 2, streak: 1, missChars: { 天: 1 }, missRoots: {} },
    history: { days: { "2026-11-19": { date: "2026-11-19", roots: { tried: 2, ok: 1, ms: 2000 } } } },
    settings: { autoNext: true },
  };
  await p.locator('[data-testid="history-import-input"]').setInputFiles({
    name: "boshiamy-backup-test.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(smaller)),
  });
  await p.waitForSelector('[data-testid="history-import-panel"]');
  await p.click('[data-testid="history-import-replace"]');
  await p.waitForSelector('[data-testid="history-msg"]');
  const replaced = await readStorage(p);
  assert.equal(replaced.stats.ok, 1);
  assert.equal(replaced.stats.tried, 2);
  assert.equal(replaced.stats.missChars["天"], 1);
  assert.ok(!replaced.history.days["2026-11-16"]);
  assert.equal(replaced.history.days["2026-11-19"].roots.tried, 2);
  assert.equal(replaced.autoNext, "1");
  const table2 = await p.locator('[data-testid="history-table"]').innerText();
  assert.match(table2, /1 \/ 2/);
  assert.doesNotMatch(table2, /11-16/);

  // merge import (exported original) back on top
  await p.locator('[data-testid="history-import-input"]').setInputFiles({
    name: "boshiamy-backup-orig.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await p.waitForSelector('[data-testid="history-import-panel"]');
  await p.click('[data-testid="history-import-merge"]');
  const merged = await readStorage(p);
  assert.equal(merged.stats.ok, 293);
  assert.equal(merged.stats.tried, 352);
  assert.equal(merged.stats.streak, 1, "merge keeps current streak");
  assert.equal(merged.history.days["2026-11-19"].roots.tried, 14);
  assert.equal(merged.history.days["2026-11-16"].article.tried, 80);
  assert.equal(merged.autoNext, "1", "merge keeps current settings");
  console.log(name, "import merge/replace ok");

  // other modes still render
  if (mobile) {
    await p.click(".gear-btn");
    await p.click('.settings-chip:has-text("查碼")');
    await p.click(".sheet-close");
    await p.waitForSelector('[data-testid="lookup-input"]');
    await p.click(".gear-btn");
    await p.click('.settings-chip:has-text("字根練習")');
    await p.click(".sheet-close");
    await p.waitForSelector('[data-testid="mobile-root"]');
  } else {
    await p.keyboard.press("Alt+Digit1");
    await p.waitForTimeout(150);
    assert.equal(await p.locator('[data-testid="history-root"]').count(), 0);
    await p.keyboard.press("Alt+Digit6");
    await p.waitForSelector('[data-testid="history-root"]');
    await p.keyboard.press("Alt+Digit5");
    await p.waitForSelector('[data-testid="lookup-input"]');
    console.log(name, "Alt+5 / Alt+6 ok");
  }
  await ctx.close();
}

await runView("desktop-light", { viewport: { width: 1280, height: 900 } }, "light");
await runView("desktop-dark", { viewport: { width: 1280, height: 900 } }, "dark");
await runView("mobile-light", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "light");
await runView("mobile-dark", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "dark");

{
  const sw = fs.readFileSync("dist/sw.js", "utf8");
  assert.match(sw, /url:"HistoryMode-[^"]+\.js"/);
  console.log("precache manifest has HistoryMode chunk");
}

await browser.close();
console.log("errors:", errs.length ? errs : "none");
if (errs.length) process.exit(1);
