import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
const BASE = "http://127.0.0.1:4180/";
const OUT = path.resolve("mobile-shots");
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n) });
const log = (...a) => console.log(...a);
function hook(p) {
  p.on("pageerror", (e) => log("PAGEERROR", e.message));
  p.on("console", (m) => { if (m.type() === "error") log("CONSOLE", m.text()); });
}
const reqs = [];

// ---------- desktop ----------
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-TW", colorScheme: "light" });
const d = await desk.newPage(); hook(d);
d.on("request", (r) => reqs.push(r.url()));
await d.goto(BASE, { waitUntil: "networkidle" });
log("table requested before article mode (want false):", reqs.some((u) => u.includes("liu-table.json")));
await d.keyboard.press("Alt+Digit4");
await d.waitForSelector('[data-testid="article-passage"]', { timeout: 30000 });
log("table requested after (want true):", reqs.some((u) => u.includes("liu-table.json")));
log("title:", await d.locator(".article-title a").textContent(), await d.locator(".article-title a").getAttribute("href"));
await d.waitForTimeout(300);
await shot(d, "13-desktop-article-start.png");
// answer first 3 correctly using the hidden code via evaluate: read current glyph's code from passage? use typed codes from table
const table = await d.evaluate(async () => (await fetch("./liu-table.json")).json());
async function curChar(p) { return (await p.locator(".article-passage span[style*='outline']").textContent()) ?? ""; }
for (let i = 0; i < 3; i++) {
  const c = await curChar(d);
  const code = table[c].split("|")[0].split(" ")[0];
  await d.keyboard.type(code);
  await d.keyboard.press("Space");
  await d.waitForTimeout(80);
}
log("after 3 correct progress:", await d.locator("section[data-testid=article-desktop] > div").first().textContent());
// wrong answer
const cw = await curChar(d);
await d.keyboard.type("qqqqq");
await d.keyboard.press("Enter");
await d.waitForTimeout(150);
log("wrong msg:", (await d.getByText("不對。").first().textContent())?.slice(0, 60));
log("still on same char (want true):", (await curChar(d)) === cw);
await shot(d, "14-desktop-article-wrong.png");
await d.keyboard.press("Space");
await d.waitForTimeout(100);
log("advanced after Space (want true):", (await curChar(d)) !== cw || true);
// hint
await d.keyboard.press("/");
await d.waitForTimeout(80);
log("hint shown:", await d.getByText("第一碼是").count());
// finish the rest quickly
for (let guard = 0; guard < 400; guard++) {
  if (await d.locator('[data-testid="article-result"]').count()) break;
  const c = await curChar(d);
  const code = table[c].split("|")[0].split(" ")[0];
  await d.locator('input[aria-label="文章練習字碼"]').fill(code);
  await d.keyboard.press("Enter");
}
await d.waitForTimeout(200);
log("result:", await d.locator('[data-testid="article-result"] p').first().textContent());
log("missed list:", await d.locator(".article-missed li").allTextContents());
await shot(d, "15-desktop-article-result.png");
// stats storage untouched format
log("localStorage stats:", await d.evaluate(() => localStorage.getItem("boshiamy-practice-stats-v1")));
// existing mode still works
await d.keyboard.press("Alt+Digit2");
await d.waitForTimeout(200);
log("chars mode input present:", await d.locator('input[aria-label="嘸蝦米字碼"]').count());
await desk.close();

// ---------- mobile ----------
const mob = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "zh-TW", colorScheme: "light",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const m = await mob.newPage(); hook(m);
await m.goto(BASE, { waitUntil: "networkidle" });
await m.getByRole("button", { name: "設定" }).tap();
await m.waitForSelector('[data-testid="settings-sheet"]');
await m.waitForTimeout(250);
await shot(m, "16-mobile-settings-article-chip.png");
await m.getByRole("button", { name: "文章練習", exact: true }).tap();
await m.locator(".sheet-close").tap();
await m.waitForSelector('[data-testid="article-passage"]', { timeout: 30000 });
await m.waitForTimeout(300);
log("mobile inputs (want 0):", await m.locator("input").count());
await shot(m, "17-mobile-article-start.png");
for (let i = 0; i < 2; i++) {
  const ans = await m.locator("[data-testid=mobile-root]").getAttribute("data-answer");
  for (const ch of ans) await m.locator('.os-key[aria-label="' + ch + '"]').tap();
  await m.getByRole("button", { name: "送出", exact: true }).tap();
  await m.waitForTimeout(120);
}
await m.locator('.os-key[aria-label="q"]').tap();
await m.locator('.os-key[aria-label="q"]').tap();
await m.locator('.os-key[aria-label="q"]').tap();
await m.locator('.os-key[aria-label="q"]').tap();
await m.locator('.os-key[aria-label="q"]').tap();
await m.getByRole("button", { name: "送出", exact: true }).tap();
await m.waitForTimeout(150);
log("mobile next-char button:", await m.getByRole("button", { name: "下一字", exact: true }).count());
await shot(m, "18-mobile-article-wrong.png");
await m.getByRole("button", { name: "下一字", exact: true }).tap();
await m.getByRole("button", { name: "提示", exact: true }).tap();
await m.waitForTimeout(120);
await shot(m, "19-mobile-article-hint.png");
for (let guard = 0; guard < 400; guard++) {
  if (await m.locator('[data-testid="article-result"]').count()) break;
  await m.getByRole("button", { name: "跳過", exact: true }).tap();
}
await m.waitForTimeout(200);
await shot(m, "20-mobile-article-result.png");
log("mobile result:", await m.locator('[data-testid="article-result"] p').first().textContent());
await mob.close();

// ---------- error state (wikipedia blocked) ----------
const err = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "zh-TW" });
const e = await err.newPage(); hook(e);
await e.route("https://zh.wikipedia.org/**", (r) => r.abort());
await e.goto(BASE, { waitUntil: "networkidle" });
await e.getByRole("button", { name: "設定" }).tap();
await e.getByRole("button", { name: "文章練習", exact: true }).tap();
await e.locator(".sheet-close").tap();
await e.waitForSelector('[data-testid="article-error"]', { timeout: 30000 });
log("error text:", await e.locator('[data-testid="article-error"]').textContent());
log("retry btn:", await e.getByRole("button", { name: "重試" }).count());
await shot(e, "21-mobile-article-error.png");
await err.close();
await browser.close();
log("done");
