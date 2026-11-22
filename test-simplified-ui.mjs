// Run against vite preview on http://127.0.0.1:4180/
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

const SIMP_EXPECTED = new Map([
  ["對", { simp: "对", code: "UAA" }],
  ["時", { simp: "时", code: "DAA" }],
  ["機", { simp: "机", code: "TRL" }],
  ["備", { simp: "备", code: "PQO" }],
  ["後", { simp: "后", code: "FOO" }],
]);

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

// 1) Short-code mode (desktop & mobile)
async function testShortMode(name, ctxOpts) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme: "light" });
  await addCspListener(ctx);
  const p = await ctx.newPage();
  hook(p);
  await p.goto(BASE, { waitUntil: "networkidle" });
  const mobile = !!ctxOpts.isMobile;

  if (mobile) {
    assert.equal(await p.locator("input").count(), 0);
    await p.click(".gear-btn");
    await p.click('.settings-chip:has-text("簡碼練習")');
    await p.click(".sheet-close");
  } else {
    await p.keyboard.press("Alt+Digit7");
  }
  await p.waitForSelector('[data-testid="short-stage"]');

  let sawOkWithSimp = false;
  let sawBadWithSimp = false;
  let sawWithoutSimp = false;
  let shotSaved = false;

  for (let i = 0; i < 15 && !(sawOkWithSimp && sawBadWithSimp && sawWithoutSimp); i++) {
    const ch = (await p.locator('[data-testid="short-glyph"]').textContent()).trim();
    const exp = SIMP_EXPECTED.get(ch);
    const submitWrong = exp && sawOkWithSimp && !sawBadWithSimp;
    const code = submitWrong ? (fullCodeOf(ch) || "qqq") : shortCodeOf(ch);

    if (mobile) {
      for (const letter of code) await p.locator(`.os-key[aria-label="${letter}"]`).tap();
      await p.click(".os-action.is-primary");
    } else {
      await p.fill('input[aria-label="嘸蝦米簡碼"]', code);
      await p.keyboard.press("Enter");
    }
    await p.waitForSelector('[data-testid="short-feedback"]');

    if (exp) {
      await p.waitForSelector('[data-testid="simp-hint"]');
      const txt = await p.locator('[data-testid="simp-hint"]').innerText();
      assert.match(txt, /簡體拆碼/);
      assert.ok(txt.includes(exp.simp), `${name} ${ch} missing ${exp.simp}: ${txt}`);
      assert.ok(txt.includes(exp.code), `${name} ${ch} missing ${exp.code}: ${txt}`);
      if (submitWrong) sawBadWithSimp = true;
      else sawOkWithSimp = true;
      if (!shotSaved) {
        const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(sw <= 0, `${name} short overflow: ${sw}`);
        await p.screenshot({ path: path.join(OUT, `simp-${mobile ? "mobile" : "desktop"}-short.png`) });
        shotSaved = true;
      }
    } else {
      assert.equal(await p.locator('[data-testid="simp-hint"]').count(), 0, `${name} ${ch} should not show simp-hint`);
      sawWithoutSimp = true;
    }

    if (mobile) {
      assert.equal(await p.locator("input").count(), 0);
      await p.click(".os-action.is-primary");
    } else {
      await p.keyboard.press("Enter");
    }
    await p.waitForFunction(() => !document.querySelector('[data-testid="short-feedback"]'));
  }

  assert.ok(sawOkWithSimp && sawBadWithSimp && sawWithoutSimp, `${name} did not cover all short cases`);
  cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
  await ctx.close();
  console.log(name, "short simplified hints ok");
}

// 2) Common-chars mode (desktop)
async function testCharsMode() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-TW", colorScheme: "light" });
  await addCspListener(ctx);
  const p = await ctx.newPage();
  hook(p);
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.keyboard.press("Alt+Digit2");
  await p.waitForSelector('input[aria-label="嘸蝦米字碼"]');

  const { SIMPLIFIED_CODE_MAP } = await (async () => {
    const { build } = await import("esbuild");
    await build({
      entryPoints: ["src/simplifiedData.ts"],
      bundle: true,
      format: "esm",
      outfile: "/tmp/simplifiedData-ui.mjs",
      logLevel: "error",
    });
    return import("/tmp/simplifiedData-ui.mjs");
  })();

  let sawOkWithSimp = false;
  let sawBadWithSimp = false;
  let sawWithoutSimp = false;
  let shotSaved = false;

  for (let i = 0; i < 60 && !(sawOkWithSimp && sawBadWithSimp && sawWithoutSimp); i++) {
    const ch = (await p.locator(".stage-card .glyph-stage").first().textContent()).trim();
    const mapped = SIMPLIFIED_CODE_MAP[ch];
    const submitWrong = mapped && sawOkWithSimp && !sawBadWithSimp;
    const item = byChar.get(ch);
    const code = submitWrong ? "qqqqq" : item.k[0];

    await p.fill('input[aria-label="嘸蝦米字碼"]', code);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(40);

    if (mapped) {
      await p.waitForSelector('[data-testid="simp-hint"]');
      const txt = await p.locator('[data-testid="simp-hint"]').innerText();
      assert.match(txt, /簡體拆碼/);
      const [simp, dk, ak] = mapped[0];
      assert.ok(txt.includes(simp), `chars ${ch} missing ${simp}: ${txt}`);
      const wantCode = (dk[0] || ak[0]).toUpperCase();
      assert.ok(txt.includes(wantCode), `chars ${ch} missing ${wantCode}: ${txt}`);
      if (submitWrong) sawBadWithSimp = true;
      else sawOkWithSimp = true;
      if (!shotSaved) {
        await p.screenshot({ path: path.join(OUT, "simp-desktop-chars.png") });
        shotSaved = true;
      }
    } else {
      assert.equal(await p.locator('[data-testid="simp-hint"]').count(), 0, `chars ${ch} should not show simp-hint`);
      sawWithoutSimp = true;
    }

    await p.keyboard.press("Enter");
    await p.waitForFunction(() => !document.querySelector('[data-testid="simp-hint"]') && !document.querySelector(".stage-card .glyph-stage.is-ok") && !document.querySelector(".stage-card .glyph-stage.is-bad"));
  }

  assert.ok(sawOkWithSimp && sawBadWithSimp && sawWithoutSimp, `chars coverage ok=${sawOkWithSimp} bad=${sawBadWithSimp} none=${sawWithoutSimp}`);
  cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
  await ctx.close();
  console.log("desktop chars simplified hints ok");
}

// 3) Article mode (desktop & mobile, mocked Wikipedia passage covering 國學體高傑)
async function testArticleMode(name, ctxOpts) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: "zh-TW", colorScheme: "light" });
  await addCspListener(ctx);
  const p = await ctx.newPage();
  hook(p);

  await p.route("https://zh.wikipedia.org/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: {
          pages: [
            {
              title: "繁簡拆碼測試條目",
              extract: "國學體高傑。這是一段專門用來測試文章練習簡體拆碼提示的中文短文，內容包含常見字與生僻字，長度足夠讓系統順利採用並逐字作答。",
            },
          ],
        },
      }),
    });
  });

  await p.goto(BASE, { waitUntil: "networkidle" });
  const mobile = !!ctxOpts.isMobile;
  if (mobile) {
    await p.click(".gear-btn");
    await p.click('.settings-chip:has-text("文章練習")');
    await p.click(".sheet-close");
  } else {
    await p.keyboard.press("Alt+Digit4");
  }
  await p.waitForSelector('[data-testid="article-passage"]', { timeout: 15000 });
  // Give non-blocking opencc-chars.json fetch a moment to settle
  await p.waitForTimeout(200);

  const checks = [
    { ch: "國", expect: ["国", "OKA"] },
    { ch: "學", expect: ["学", "SNZ"] },
    { ch: "體", expect: ["体", "PTE", "要選字"] },
    { ch: "高", expect: null },
    { ch: "傑", expect: ["杰", "TFA", "要選字"] },
  ];

  for (const step of checks) {
    if (mobile) {
      assert.equal(await p.locator("input").count(), 0, "mobile article has 0 <input>");
      for (let k = 0; k < 4; k++) await p.locator('.os-key[aria-label="q"]').tap();
      await p.click(".os-action.is-primary");
    } else {
      await p.fill('input[aria-label="文章練習字碼"]', "qqqqq");
      await p.keyboard.press("Enter");
    }

    if (step.expect) {
      await p.waitForSelector('[data-testid="simp-hint"]');
      const txt = await p.locator('[data-testid="simp-hint"]').innerText();
      assert.match(txt, /簡體拆碼/);
      for (const token of step.expect) {
        assert.ok(txt.includes(token), `${name} article ${step.ch} missing ${token}: ${txt}`);
      }
      if (!mobile && step.ch === "國") {
        await p.screenshot({ path: path.join(OUT, "simp-desktop-article.png") });
      }
    } else {
      await p.waitForTimeout(50);
      assert.equal(await p.locator('[data-testid="simp-hint"]').count(), 0, `${name} article ${step.ch} should not show simp-hint`);
    }

    const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(sw <= 0, `${name} article overflow at ${step.ch}: ${sw}`);

    if (mobile) {
      await p.click(".os-action.is-primary");
    } else {
      await p.keyboard.press("Enter");
    }
    await p.waitForFunction(() => !document.querySelector('[data-testid="simp-hint"]'));
    await p.waitForTimeout(40);
  }

  cspViolations.push(...(await p.evaluate(() => window.__cspViolations || [])));
  await ctx.close();
  console.log(name, "article simplified hints ok");
}

await testShortMode("desktop", { viewport: { width: 1280, height: 900 } });
await testShortMode("mobile", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await testCharsMode();
await testArticleMode("desktop", { viewport: { width: 1280, height: 900 } });
await testArticleMode("mobile", { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

await browser.close();
assert.equal(cspViolations.length, 0, "CSP violations: " + JSON.stringify(cspViolations));
assert.equal(errs.length, 0, "Browser errors: " + errs.join(" | "));
console.log("SIMPLIFIED UI ALL OK");
