import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:4180/";
const OUT = path.resolve("mobile-shots");
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const errs = [];
function hook(p) {
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
}
async function run(name, ctxOpts, scheme) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme: scheme });
  const p = await ctx.newPage();
  hook(p);
  await p.goto(BASE);
  await p.waitForTimeout(500);
  const mobile = !!ctxOpts.isMobile;
  if (mobile) {
    await p.click(".gear-btn");
    await p.click('.settings-chip:has-text("查碼")');
    await p.click(".sheet-close");
  } else {
    await p.click('[role=tab]:has-text("查碼")');
  }
  await p.waitForSelector('[data-testid="lookup-input"]');
  const inp = p.locator('[data-testid="lookup-input"]');
  await inp.fill("我的嘸蝦米，虾 発 高 龘");
  await p.waitForSelector('[data-testid="lookup-results"] li');
  const rows = await p.$$eval('[data-testid="lookup-results"] > li', (l) => l.map((x) => x.innerText.replace(/\s+/g, " ")));
  console.log(name, rows);
  const row = (c) => p.locator(`li[data-char="${c}"]`).innerText();
  assert.match(await row("我"), /IX/);
  assert.match(await row("的"), /D[\s\S]*最短碼[\s\S]*PDNA/);
  assert.match(await row("嘸"), /OEK[\s\S]*OVFF[\s\S]*OGL[\s\S]*要選字/);
  assert.match(await row("蝦"), /COX/);
  assert.match(await row("蝦"), /簡體[\s\S]*虾[\s\S]*查無/);
  assert.match(await row("虾"), /查無[\s\S]*繁體[\s\S]*蝦[\s\S]*CFA/);
  assert.match(await row("発"), /查無/);
  assert.doesNotMatch(await row("龘"), /查無/);
  assert.ok(!(await p.locator('li[data-char="，"]').count()));
  await p.screenshot({ path: path.join(OUT, `lookup-${name}-forward.png`) });
  // 發 / 发
  await inp.fill("發发高");
  await p.waitForSelector('li[data-char="发"]');
  assert.match(await row("發"), /简體|簡體[\s\S]*发/);
  assert.match(await row("发"), /繁體[\s\S]*發[\s\S]*髮/);
  assert.equal(await p.locator('li[data-char="高"] [data-testid="lookup-variants"]').count(), 0);
  // reverse
  await inp.fill("ab");
  await p.waitForSelector("li[data-code=ab]");
  const rev = await p.locator("li[data-code=ab]").innerText();
  assert.match(rev, /鎮/);
  await p.screenshot({ path: path.join(OUT, `lookup-${name}-reverse.png`) });
  await p.locator("li[data-code=ab] .lookup-char-btn", { hasText: "鎮" }).click();
  await p.waitForSelector('li[data-char="鎮"]');
  // IME composition: while composing, query must not change; on end it does
  await inp.fill("米");
  await inp.evaluate((el) => {
    el.focus();
    el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    set.call(el, "米ㄇㄧ");
    el.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, data: "ㄇㄧ", inputType: "insertCompositionText" }));
  });
  await p.waitForTimeout(100);
  assert.equal(await p.locator('[data-testid="lookup-results"] > li').count(), 1, "frozen while composing");
  await inp.evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    set.call(el, "米蝦");
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText" }));
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "蝦" }));
  });
  await p.waitForSelector('li[data-char="蝦"]');
  assert.equal(await p.locator('[data-testid="lookup-results"] > li').count(), 2);
  // typing in the box must not switch modes or trigger shortcuts (keys 1-5, k, /, space, Enter, Esc)
  await inp.fill("");
  await inp.click();
  await p.keyboard.type("12345k/ \n", { delay: 10 });
  await p.keyboard.press("Escape");
  assert.ok(await inp.isVisible(), "still in lookup");
  assert.equal(await inp.inputValue(), "12345k/ \n");
  assert.equal(await p.locator("[data-testid=lookup-input]").count(), 1);
  await p.screenshot({ path: path.join(OUT, `lookup-${name}-empty-state.png`) });
  // overflow check
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sw <= 0, "no horizontal overflow " + sw);
  // other modes still render
  if (mobile) {
    for (const [lab, sel] of [["字根練習", '[data-testid="mobile-root"]'], ["常用字", '[data-testid="mobile-root"]'], ["限時挑戰", '[data-testid="mobile-root"]'], ["文章練習", ".article-q"]]) {
      await p.click(".gear-btn");
      await p.click(`.settings-chip:has-text("${lab}")`);
      await p.click(".sheet-close");
      await p.waitForSelector(sel);
      console.log(name, "mode ok:", lab);
    }
  } else {
    await inp.fill("");
    await p.keyboard.press("Alt+Digit1");
    await p.waitForTimeout(150);
    assert.equal(await p.locator('[data-testid="lookup-input"]').count(), 0);
    await p.keyboard.press("Alt+Digit2"); await p.waitForTimeout(100);
    await p.keyboard.press("Alt+Digit3"); await p.waitForTimeout(100);
    await p.keyboard.press("Alt+Digit4"); await p.waitForSelector('[data-testid="article-desktop"]');
    await p.keyboard.press("Alt+Digit5"); await p.waitForSelector('[data-testid="lookup-input"]');
    console.log(name, "Alt+1..5 ok");
    // roots mode typing still works
    await p.keyboard.press("Alt+Digit1"); await p.waitForTimeout(200);
    const txt = await p.locator("body").innerText();
    assert.ok(/字根練習/.test(txt));
  }
  await ctx.close();
}
await run("desktop-light", { viewport: { width: 1280, height: 900 } }, "light");
await run("desktop-dark", { viewport: { width: 1280, height: 900 } }, "dark");
await run("mobile-light", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "light");
await run("mobile-dark", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "dark");
// offline: headless Chrome in this box never fills CacheStorage (same for the previous build), so check the precache manifest instead.
{
  const sw = (await import("node:fs")).readFileSync("dist/sw.js", "utf8");
  for (const f of ["liu-table.json", "opencc-chars.json"]) assert.ok(sw.includes('url:"' + f + '"'), f + " precached");
  assert.match(sw, /url:"LookupMode-[^"]+\.js"/);
  console.log("precache manifest has table, opencc-chars.json and LookupMode chunk");
}
await browser.close();
console.log("errors:", errs.length ? errs : "none");
