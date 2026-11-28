// Run with preview server on http://127.0.0.1:4180/
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = "http://127.0.0.1:4180/";

const MOCK_WIKI_API = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 12345,
        ns: 0,
        title: "測試條目",
        extract: "的的一一的的一一的的一一的的一一的的一一的的一一的的一一的的一一。",
      },
    ],
  },
};

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

async function runScenario(name, ctxOpts, colorScheme) {
  const mobile = !!ctxOpts.isMobile;

  // 1) Root decay (2 -> 1) & Char decay (1 -> graduated + review cleared)
  {
    const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme });
    await addCspListener(ctx);
    await ctx.addInitScript(() => {
      localStorage.setItem(
        "boshiamy-practice-stats-v1",
        JSON.stringify({ ok: 10, tried: 12, streak: 0, missChars: {}, missRoots: { "d:日": 2 } }),
      );
      localStorage.setItem("boshiamy-auto-next-v2", "0");
    });
    const p = await ctx.newPage();
    hook(p);
    await p.goto(BASE, { waitUntil: "networkidle" });
    if (mobile) {
      assert.equal(await p.locator("input").count(), 0, name + ": mobile must have 0 inputs");
      await p.click('[data-testid="mobile-weak-cta"]');
    } else {
      await p.click('[data-testid="today-review-cta"]');
    }
    await p.waitForTimeout(80);
    if (mobile) {
      await p.click('.os-key[aria-label="d"]');
      await p.getByRole("button", { name: "送出", exact: true }).tap();
    } else {
      await p.fill('input[aria-label="字根對應按鍵"]', "d");
      await p.keyboard.press("Enter");
    }
    await p.waitForTimeout(80);
    const statsAfter = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-practice-stats-v1") || "{}"));
    assert.equal(statsAfter.missRoots["d:日"], 1, name + ": root miss should decay 2 -> 1");
    cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme });
    await addCspListener(ctx);
    await ctx.addInitScript(() => {
      localStorage.setItem(
        "boshiamy-practice-stats-v1",
        JSON.stringify({ ok: 10, tried: 12, streak: 0, missChars: { 我: 1 }, missRoots: {} }),
      );
      localStorage.setItem("boshiamy-auto-next-v2", "0");
    });
    const p = await ctx.newPage();
    hook(p);
    await p.goto(BASE, { waitUntil: "networkidle" });
    if (mobile) {
      await p.click('[data-testid="mobile-weak-cta"]');
    } else {
      await p.click('[data-testid="today-review-cta"]');
    }
    await p.waitForTimeout(80);
    if (mobile) {
      await p.click('.os-key[aria-label="i"]');
      await p.click('.os-key[aria-label="x"]');
      await p.getByRole("button", { name: "送出", exact: true }).tap();
    } else {
      await p.fill('input[aria-label="嘸蝦米字碼"]', "ix");
      await p.keyboard.press("Enter");
    }
    await p.waitForSelector('[data-testid="weak-graduated-badge"]');
    const statsAfter = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-practice-stats-v1") || "{}"));
    assert.equal(
      Object.prototype.hasOwnProperty.call(statsAfter.missChars || {}, "我"),
      false,
      name + ": graduated char must be deleted from missChars",
    );

    // Advance to next question -> review cleared state
    if (mobile) {
      await p.getByRole("button", { name: "下一題", exact: true }).tap();
    } else {
      await p.keyboard.press("Enter");
    }
    await p.waitForSelector('[data-testid="review-cleared-state"]');
    await p.click('[data-testid="review-back-normal-btn"]');
    await p.waitForFunction(() => !document.querySelector('[data-testid="review-cleared-state"]'));
    if (mobile) {
      assert.equal(await p.locator("input").count(), 0, name + ": mobile must stay 0 inputs after review cleared");
    }

    // Drill star + drill lookup
    if (mobile) {
      await p.click('.os-key[aria-label="z"]');
      await p.click('.os-key[aria-label="z"]');
      await p.getByRole("button", { name: "送出", exact: true }).tap();
    } else {
      await p.fill('input[aria-label="嘸蝦米字碼"]', "zz");
      await p.keyboard.press("Enter");
    }
    await p.waitForSelector('[data-testid="drill-star-btn"]');
    const drillChar = await p.getAttribute('[data-testid="drill-star-btn"]', "data-char");
    await p.click('[data-testid="drill-star-btn"]');
    const wb1 = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-wordbook-v1") || "[]"));
    assert.ok(wb1.includes(drillChar), name + ": drill-star-btn should save " + drillChar);
    await p.click('[data-testid="drill-lookup-btn"]');
    await p.waitForSelector('[data-testid="lookup-results"]');
    assert.equal(await p.inputValue('[data-testid="lookup-input"]'), drillChar, name + ": lookup should prefill " + drillChar);

    cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
    await ctx.close();
  }

  // 2) Article mode feedback star + result star-all + missed lookup
  {
    const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme });
    await addCspListener(ctx);
    await ctx.route("https://zh.wikipedia.org/w/api.php**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WIKI_API),
      }),
    );
    const p = await ctx.newPage();
    hook(p);
    await p.goto(BASE, { waitUntil: "networkidle" });
    if (mobile) {
      await p.click('[data-testid="mobile-mode-chip-article"]');
    } else {
      await p.keyboard.press("Alt+Digit4");
    }
    await p.waitForSelector('[data-testid="article-passage"]');

    // Miss first char ("的"), test article-star-btn toggle (add then remove so star-all adds it)
    if (mobile) {
      await p.click('.os-key[aria-label="q"]');
      await p.click('.os-key[aria-label="q"]');
      await p.getByRole("button", { name: "送出", exact: true }).tap();
    } else {
      await p.fill('input[aria-label="文章練習字碼"]', "qq");
      await p.keyboard.press("Enter");
    }
    await p.waitForSelector('[data-testid="article-star-btn"]');
    await p.click('[data-testid="article-star-btn"]');
    let wbArt = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-wordbook-v1") || "[]"));
    assert.ok(wbArt.includes("的"), name + ": article-star-btn should add 的");
    await p.click('[data-testid="article-star-btn"]');
    wbArt = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-wordbook-v1") || "[]"));
    assert.ok(!wbArt.includes("的"), name + ": article-star-btn toggle should remove 的");

    // Advance past bad char
    if (mobile) {
      await p.getByRole("button", { name: "下一字", exact: true }).tap();
    } else {
      await p.keyboard.press("Space");
    }

    // Complete remaining chars quickly
    for (let guard = 0; guard < 60; guard++) {
      if (await p.locator('[data-testid="article-result"]').count()) break;
      if (mobile) {
        const ans = await p.locator('[data-testid="mobile-root"]').getAttribute("data-answer");
        for (const ch of ans || "") await p.click(`.os-key[aria-label="${ch}"]`);
        await p.getByRole("button", { name: "送出", exact: true }).tap();
      } else {
        const curText = await p.locator('.article-passage span[style*="outline"]').textContent();
        const code = curText === "的" ? "d" : "e";
        await p.fill('input[aria-label="文章練習字碼"]', code);
        await p.keyboard.press("Enter");
      }
      await p.waitForTimeout(20);
    }

    await p.waitForSelector('[data-testid="article-star-all"]');
    await p.click('[data-testid="article-star-all"]');
    wbArt = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-wordbook-v1") || "[]"));
    assert.ok(wbArt.includes("的"), name + ": article-star-all should add missed chars");
    await p.click('[data-testid="article-missed-lookup"]');
    await p.waitForSelector('[data-testid="lookup-results"]');
    assert.equal(await p.inputValue('[data-testid="lookup-input"]'), "的", name + ": article missed lookup should jump to 的");

    cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
    await ctx.close();
  }

  // 3) History 26-key heatmap + weak rank star-all & lookup + mobile settings phrases button
  {
    const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme });
    await addCspListener(ctx);
    await ctx.addInitScript(() => {
      localStorage.setItem(
        "boshiamy-practice-stats-v1",
        JSON.stringify({ ok: 20, tried: 28, streak: 2, missChars: { 我: 3, 國: 1 }, missRoots: { "d:日": 4 } }),
      );
    });
    const p = await ctx.newPage();
    hook(p);
    await p.goto(BASE, { waitUntil: "networkidle" });

    if (mobile) {
      assert.equal(await p.locator("input").count(), 0, name + ": mobile start should have 0 inputs");
      await p.click(".gear-btn");
      await p.waitForSelector('[data-testid="settings-sheet"]');
      const phraseChip = p.locator('[data-testid="settings-sheet"] button.settings-chip:has-text("詞彙連打")');
      assert.equal(await phraseChip.count(), 1, name + ": mobile settings sheet must include 詞彙連打");
      await phraseChip.click();
      await p.click(".sheet-close");
      await p.waitForSelector('[data-testid="phrase-stage"]');
      assert.equal(await p.locator("input").count(), 0, name + ": mobile phrase mode must have 0 inputs");
      await p.click('[data-testid="mobile-mode-chip-history"]');
    } else {
      await p.keyboard.press("Alt+Digit6");
    }

    await p.waitForSelector('[data-testid="history-kb-heatmap"]');
    assert.equal(await p.locator('[data-testid^="kb-hm-key-"]').count(), 26, name + ": must render 26 keycaps");
    assert.ok(Number(await p.getAttribute('[data-testid="kb-hm-key-d"]', "data-level")) > 0, name + ": D key level > 0");
    assert.ok(Number(await p.getAttribute('[data-testid="kb-hm-key-i"]', "data-level")) > 0, name + ": I key level > 0");
    assert.ok(Number(await p.getAttribute('[data-testid="kb-hm-key-x"]', "data-level")) > 0, name + ": X key level > 0");

    // Switch to roots mode
    await p.click('[data-testid="kb-hm-mode-roots"]');
    assert.equal(await p.getAttribute('[data-testid="kb-hm-key-i"]', "data-level"), "0", name + ": I key level 0 in roots mode");
    assert.ok(Number(await p.getAttribute('[data-testid="kb-hm-key-d"]', "data-level")) > 0, name + ": D key stays > 0 in roots mode");

    // Switch to chars mode
    await p.click('[data-testid="kb-hm-mode-chars"]');
    assert.ok(Number(await p.getAttribute('[data-testid="kb-hm-key-i"]', "data-level")) > 0, name + ": I key > 0 in chars mode");
    assert.equal(await p.getAttribute('[data-testid="kb-hm-key-d"]', "data-level"), "0", name + ": D key 0 in chars mode");

    // Back to all mode, click key I -> detail panel shows 我 + star works
    await p.click('[data-testid="kb-hm-mode-all"]');
    await p.click('[data-testid="kb-hm-key-i"]');
    const detailText = await p.textContent('[data-testid="history-kb-detail"]');
    assert.match(detailText || "", /我/, name + ": detail panel for I should mention 我");
    await p.click('[data-testid="kb-hm-char-star"][data-char="我"]');
    let wbHist = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-wordbook-v1") || "[]"));
    assert.ok(wbHist.includes("我"), name + ": kb-hm-char-star should save 我");

    // Weak rank batch star-all adds remaining char ("國")
    await p.click('[data-testid="history-weak-star-all"]');
    wbHist = await p.evaluate(() => JSON.parse(localStorage.getItem("boshiamy-wordbook-v1") || "[]"));
    assert.ok(wbHist.includes("國"), name + ": history-weak-star-all should save 國");

    // Check horizontal overflow in history page before jumping
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(sw <= 1, name + ": horizontal overflow in history page: " + sw);

    // Weak item lookup jumps to LookupMode
    await p.click('[data-testid="weak-item-lookup"][data-char="我"]');
    await p.waitForSelector('[data-testid="lookup-results"]');
    assert.equal(await p.inputValue('[data-testid="lookup-input"]'), "我", name + ": weak-item-lookup should open 我");

    cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
    await ctx.close();
  }
}

try {
  await runScenario("desktop-light", { viewport: { width: 1280, height: 900 } }, "light");
  await runScenario("desktop-dark", { viewport: { width: 1280, height: 900 } }, "dark");
  await runScenario(
    "mobile-light",
    { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    "light",
  );
  await runScenario(
    "mobile-dark",
    { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    "dark",
  );
} finally {
  await browser.close();
}

assert.equal(errs.length, 0, "Runtime errors:\n" + errs.join("\n"));
assert.equal(cspViolations.length, 0, "CSP violations:\n" + JSON.stringify(cspViolations));
console.log("test-weakness-ui: ALL PASSED (desktop + mobile, light + dark)");
