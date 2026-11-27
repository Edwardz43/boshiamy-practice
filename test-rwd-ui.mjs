import { chromium } from "playwright-core";

const URL = "http://127.0.0.1:4180/";
const MOCK_WIKI = {
  title: "測試條目",
  extract: "這是一段用來驗證桌面縮在角落時文章練習版面不會被鍵盤遮住的測試文章，包含常用字與標點符號。",
  content_urls: { desktop: { page: "https://zh.wikipedia.org/wiki/%E6%B8%AC%E8%A9%A6" } },
};

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  // 1. Desktop corner window (600x600, non-touch)
  const corner = await browser.newContext({
    viewport: { width: 600, height: 600 },
    locale: "zh-TW",
    colorScheme: "dark",
  });
  await corner.route("https://zh.wikipedia.org/api/rest_v1/page/random/summary", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_WIKI),
    }),
  );
  const p = await corner.newPage();
  await p.goto(URL, { waitUntil: "networkidle" });

  // Switch to 常用字
  await p.getByTestId("mobile-mode-chip-chars").click();
  await p.waitForSelector('[data-testid="os-kb"]');

  // Virtual keyboard should be collapsed by default on fine-pointer desktop
  assert((await p.locator(".os-row").count()) === 0, "corner desktop should collapse letter rows by default");
  assert((await p.getByTestId("os-kb-toggle").count()) === 1, "corner desktop should show keyboard toggle");

  // Toggle keyboard open and back closed
  await p.getByTestId("os-kb-toggle").click();
  assert((await p.locator(".os-row").count()) === 3, "clicking toggle should expand 3 letter rows");
  await p.getByTestId("os-kb-toggle").click();
  assert((await p.locator(".os-row").count()) === 0, "clicking toggle again should collapse letter rows");

  // Type wrong answer via physical keyboard and verify KeycapBreakdown is visible within stage without clipping
  await p.keyboard.type("zzz");
  await p.keyboard.press("Enter");
  await p.waitForSelector('[data-testid="keycap-breakdown"]');
  const charsMetrics = await p.evaluate(() => {
    const stage = document.querySelector(".mobile-stage");
    const bd = document.querySelector('[data-testid="keycap-breakdown"]');
    const sr = stage.getBoundingClientRect();
    const br = bd.getBoundingClientRect();
    return { stageBottom: sr.bottom, bdBottom: br.bottom, bdTop: br.top, stageTop: sr.top };
  });
  assert(
    charsMetrics.bdBottom <= charsMetrics.stageBottom + 2 && charsMetrics.bdTop >= charsMetrics.stageTop - 2,
    "常用字 keycap-breakdown clipped in 600x600 corner window: " + JSON.stringify(charsMetrics),
  );

  // Switch to 文章 mode, submit wrong answer, verify KeycapBreakdown fits cleanly
  await p.getByTestId("mobile-mode-chip-article").click();
  await p.waitForSelector('[data-testid="article-passage"]');
  assert((await p.locator(".os-row").count()) === 0, "article mode on corner desktop should collapse keyboard");
  await p.keyboard.type("zzz");
  await p.keyboard.press("Enter");
  await p.waitForSelector('[data-testid="keycap-breakdown"]');
  const artMetrics = await p.evaluate(() => {
    const stage = document.querySelector(".mobile-stage");
    const bd = document.querySelector('[data-testid="keycap-breakdown"]');
    const sr = stage.getBoundingClientRect();
    const br = bd.getBoundingClientRect();
    return { stageBottom: sr.bottom, bdBottom: br.bottom, bdTop: br.top, stageTop: sr.top };
  });
  assert(
    artMetrics.bdBottom <= artMetrics.stageBottom + 2 && artMetrics.bdTop >= artMetrics.stageTop - 2,
    "文章 keycap-breakdown clipped in 600x600 corner window: " + JSON.stringify(artMetrics),
  );
  await corner.close();

  // 2. Touch mobile (390x780, isMobile + hasTouch): keyboard stays expanded by default, no toggle button
  const mob = await browser.newContext({
    viewport: { width: 390, height: 780 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "zh-TW",
  });
  const mp = await mob.newPage();
  await mp.goto(URL, { waitUntil: "networkidle" });
  await mp.getByTestId("mobile-mode-chip-chars").click();
  await mp.waitForSelector('[data-testid="os-kb"]');
  assert((await mp.locator(".os-row").count()) === 3, "touch mobile should keep 3 letter rows expanded");
  assert((await mp.getByTestId("os-kb-toggle").count()) === 0, "touch mobile should not show collapse toggle");
  await mob.close();

  console.log("RWD UI TESTS PASSED");
} finally {
  await browser.close();
}
