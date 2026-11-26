// Run: node test-history.mjs  (bundles src/historyLogic.ts with esbuild)
import { build } from "esbuild";
import assert from "node:assert/strict";

await build({
  entryPoints: ["src/historyLogic.ts"],
  bundle: true,
  format: "esm",
  outfile: "/tmp/historyLogic.mjs",
  logLevel: "error",
});
const H = await import("/tmp/historyLogic.mjs");

assert.equal(H.localDate(new Date(2026, 10, 19)), "2026-11-19");
assert.ok(H.isDateKey("2026-11-19"));
assert.ok(!H.isDateKey("2026-13-01"));
assert.ok(!H.isDateKey("11/19"));
assert.equal(H.addDays("2026-11-19", -1), "2026-11-18");
assert.equal(H.addDays("2026-03-01", -1), "2026-02-28");
assert.deepEqual(H.dateRange("2026-11-19", 3), ["2026-11-17", "2026-11-18", "2026-11-19"]);

let hist = H.emptyHistory();
hist = H.recordAttempt(hist, "roots", { tried: 1, ok: 1, ms: 1500 }, "2026-11-19");
hist = H.recordAttempt(hist, "roots", { tried: 1, ok: 0, ms: 2500 }, "2026-11-19");
hist = H.recordAttempt(hist, "chars", { tried: 2, ok: 2, ms: 4000 }, "2026-11-19");
hist = H.recordAttempt(hist, "article", { tried: 10, ok: 8, ms: 60000 }, "2026-11-18");
const day = hist.days["2026-11-19"];
assert.equal(day.roots.tried, 2);
assert.equal(day.roots.ok, 1);
assert.equal(day.roots.ms, 4000);
assert.equal(H.dayTotals(day, "all").tried, 4);
assert.equal(H.formatPct(day.roots), "50%");
assert.equal(H.formatSecPerItem(day.roots), "2.0 秒/題");
assert.equal(H.formatCpm(hist.days["2026-11-18"].article), "8 字/分");
assert.equal(H.formatDuration(90000), "1 分 30 秒");

const series = H.seriesFor(hist, "2026-11-19", 3, "all");
assert.equal(series.length, 3);
assert.equal(series[0].date, "2026-11-17");
assert.equal(series[0].stats.tried, 0);
assert.equal(series[1].stats.ok, 8);
assert.equal(series[2].accuracy, 3 / 4);
const totals = H.rangeTotals(hist, "2026-11-19", 7, "all");
assert.equal(totals.tried, 14);
assert.equal(totals.ok, 11);

// prune keeps the newest MAX days
let fat = H.emptyHistory();
for (let i = 0; i < H.MAX_HISTORY_DAYS + 5; i++) {
  fat = H.recordAttempt(fat, "chars", { tried: 1, ok: 1, ms: 100 }, H.addDays("2026-11-19", -i));
}
assert.equal(Object.keys(fat.days).length, H.MAX_HISTORY_DAYS);
assert.ok(fat.days["2026-11-19"]);
assert.ok(!fat.days[H.addDays("2026-11-19", -(H.MAX_HISTORY_DAYS))]);

// clip long item times
assert.equal(H.clipMs(-10), 0);
assert.equal(H.clipMs(H.MAX_ITEM_MS + 1), H.MAX_ITEM_MS);

// backup / parse / merge / replace
const statsA = { ok: 10, tried: 20, streak: 3, missChars: { 我: 2 }, missRoots: { "a:日": 1 } };
const statsB = { ok: 4, tried: 5, streak: 9, missChars: { 我: 1, 的: 2 }, missRoots: {} };
const histB = H.recordAttempt(H.emptyHistory(), "roots", { tried: 3, ok: 3, ms: 3000 }, "2026-11-19");
const backup = H.makeBackup({
  stats: statsB,
  history: histB,
  settings: { autoNext: true },
  exportedAt: "2026-11-19T00:00:00.000Z",
});
assert.equal(backup.version, 1);
const json = H.backupToJson(backup);
assert.match(json, /"version": 1/);
assert.equal(H.backupFilename("2026-11-19"), "boshiamy-backup-2026-11-19.json");

const parsed = H.parseBackup(json);
assert.equal(parsed.ok, true);
assert.equal(parsed.data.stats.ok, 4);

const cur = { stats: statsA, history: hist, settings: { autoNext: false } };
const merged = H.applyBackup(cur, parsed.data, "merge");
assert.equal(merged.stats.ok, 14);
assert.equal(merged.stats.tried, 25);
assert.equal(merged.stats.streak, 3, "merge keeps current streak");
assert.equal(merged.stats.missChars["我"], 3);
assert.equal(merged.stats.missChars["的"], 2);
assert.equal(merged.history.days["2026-11-19"].roots.tried, 5);
assert.equal(merged.settings.autoNext, false, "merge keeps current settings");

const replaced = H.applyBackup(cur, parsed.data, "replace");
assert.equal(replaced.stats.ok, 4);
assert.equal(replaced.stats.streak, 9);
assert.equal(replaced.stats.missChars["的"], 2);
assert.ok(!replaced.stats.missChars["我"] || replaced.stats.missChars["我"] === 1);
assert.equal(replaced.history.days["2026-11-19"].roots.tried, 3);
assert.ok(!replaced.history.days["2026-11-18"]);
assert.equal(replaced.settings.autoNext, true);

// invalid backups
assert.equal(H.parseBackup("not-json").ok, false);
assert.equal(H.parseBackup("{}").ok, false);
assert.equal(H.parseBackup(JSON.stringify({ version: 99, stats: statsA })).ok, false);
assert.equal(H.parseBackup(JSON.stringify({ version: 1 })).ok, false);

// sanitizes bad numbers and unknown modes
const dirty = H.parseBackup(
  JSON.stringify({
    version: 1,
    stats: { ok: -3, tried: 2.9, streak: "x", missChars: { 好: 2, bad: -1, empty: 0 } },
    history: {
      days: {
        "2026-11-19": { roots: { tried: 5, ok: 9, ms: -10 }, nope: { tried: 1 } },
        "not-a-date": { roots: { tried: 1, ok: 1, ms: 1 } },
      },
    },
    settings: { autoNext: 1 },
  }),
);
assert.equal(dirty.ok, true);
assert.equal(dirty.data.stats.ok, 0);
assert.equal(dirty.data.stats.tried, 2);
assert.equal(dirty.data.stats.missChars["好"], 2);
assert.ok(!dirty.data.stats.missChars.bad);
assert.equal(dirty.data.history.days["2026-11-19"].roots.ok, 5, "ok clamped to tried");
assert.equal(dirty.data.history.days["2026-11-19"].roots.ms, 0);
assert.ok(!dirty.data.history.days["not-a-date"]);
assert.equal(dirty.data.settings.autoNext, true);

// load / save via fake storage
const store = {};
H.saveHistoryToStorage((k, v) => {
  store[k] = v;
}, hist);
const loaded = H.loadHistoryFromStorage((k) => store[k] ?? null);
assert.equal(loaded.days["2026-11-19"].chars.tried, 2);
assert.deepEqual(H.loadHistoryFromStorage(() => "{not json"), H.emptyHistory());
assert.deepEqual(H.loadHistoryFromStorage(() => null), H.emptyHistory());


// oversize rejection (file size helper + parseBackup string length)
assert.equal(H.oversizedBackupMessage(H.MAX_BACKUP_BYTES), null);
assert.equal(H.oversizedBackupMessage(100), null);
assert.equal(H.oversizedBackupMessage(H.MAX_BACKUP_BYTES + 1) != null, true);
assert.match(H.oversizedBackupMessage(H.MAX_BACKUP_BYTES + 1), /2 MB/);
const huge = H.parseBackup("x".repeat(H.MAX_BACKUP_BYTES + 1));
assert.equal(huge.ok, false);
assert.match(huge.error, /2 MB/);

// __proto__ / constructor / prototype keys ignored; no prototype pollution
const protoRaw = `{
  "version": 1,
  "stats": {
    "ok": 1,
    "tried": 1,
    "streak": 0,
    "missChars": { "我": 2, "__proto__": 9, "constructor": 8, "prototype": 7 },
    "missRoots": { "a:日": 1, "__proto__": { "polluted": 1 } }
  },
  "history": { "days": {} },
  "settings": { "autoNext": false }
}`;
const protoParsed = H.parseBackup(protoRaw);
assert.equal(protoParsed.ok, true);
assert.equal(protoParsed.data.stats.missChars["我"], 2);
assert.equal(protoParsed.data.stats.missRoots["a:日"], 1);
assert.equal(Object.prototype.hasOwnProperty.call(protoParsed.data.stats.missChars, "__proto__"), false);
assert.equal(Object.prototype.hasOwnProperty.call(protoParsed.data.stats.missChars, "constructor"), false);
assert.equal(Object.prototype.hasOwnProperty.call(protoParsed.data.stats.missChars, "prototype"), false);
assert.equal(Object.prototype.hasOwnProperty.call(protoParsed.data.stats.missRoots, "__proto__"), false);
assert.equal(Object.getPrototypeOf(protoParsed.data.stats.missChars), null);
assert.equal(({}).polluted, undefined);
assert.equal(Object.prototype.polluted, undefined);

// huge key counts capped
const many = {};
for (let i = 0; i < 6000; i++) many["k" + String(i).padStart(4, "0")] = 1;
const capped = H.countMap(many);
assert.equal(Object.keys(capped).length, H.MAX_MAP_KEYS);
assert.equal(capped["k0000"], 1);
assert.ok(!capped["k5999"]);
const manyBackup = H.parseBackup(JSON.stringify({
  version: 1,
  stats: { ok: 1, tried: 1, streak: 0, missChars: many, missRoots: {} },
  history: { days: {} },
  settings: { autoNext: false },
}));
assert.equal(manyBackup.ok, true);
assert.equal(Object.keys(manyBackup.data.stats.missChars).length, H.MAX_MAP_KEYS);

// oversized ints clamped
const big = H.sanitizeStats({ ok: 1e15, tried: 1e15, streak: Infinity, missChars: { 我: 9e12 } });
assert.equal(big.ok, H.MAX_INT);
assert.equal(big.tried, H.MAX_INT);
assert.equal(big.streak, 0);
assert.equal(big.missChars["我"], H.MAX_INT);

// a normal backup round-trips unchanged
const json1 = H.backupToJson(backup);
const parsed1 = H.parseBackup(json1);
assert.equal(parsed1.ok, true);
assert.deepEqual(JSON.parse(H.backupToJson(parsed1.data)), JSON.parse(json1));
assert.equal(parsed1.data.stats.ok, backup.stats.ok);
assert.deepEqual(JSON.parse(JSON.stringify(parsed1.data.stats)), JSON.parse(JSON.stringify(backup.stats)));
assert.deepEqual(JSON.parse(JSON.stringify(parsed1.data.history)), JSON.parse(JSON.stringify(backup.history)));
assert.deepEqual(parsed1.data.settings, backup.settings);
assert.equal(parsed1.data.version, backup.version);
assert.equal(parsed1.data.exportedAt, backup.exportedAt);

// short-code mode recording + legacy backup compatibility
{
  let sh = H.emptyHistory();
  sh = H.recordAttempt(sh, "short", { tried: 3, ok: 2, ms: 4500 }, "2026-11-21");
  const d = sh.days["2026-11-21"];
  assert.equal(d.short.tried, 3);
  assert.equal(d.short.ok, 2);
  assert.equal(d.short.ms, 4500);
  assert.equal(H.dayTotals(d, "all").tried, 3);
  assert.equal(H.dayTotals(d, "short").ok, 2);

  const b = H.makeBackup({ stats: statsA, history: sh, settings: { autoNext: false }, exportedAt: "2026-11-21T00:00:00.000Z" });
  const rt = H.parseBackup(H.backupToJson(b));
  assert.equal(rt.ok, true);
  assert.equal(rt.data.history.days["2026-11-21"].short.tried, 3);

  // legacy backup without short mode still imports & merges cleanly
  const legacy = H.parseBackup(JSON.stringify({
    version: 1,
    exportedAt: "2026-11-19T00:00:00.000Z",
    stats: statsB,
    history: { days: { "2026-11-21": { date: "2026-11-21", chars: { tried: 2, ok: 1, ms: 2000 } } } },
    settings: { autoNext: true },
  }));
  assert.equal(legacy.ok, true);
  const mergedShort = H.applyBackup({ stats: statsA, history: sh, settings: { autoNext: false } }, legacy.data, "merge");
  assert.equal(mergedShort.history.days["2026-11-21"].short.tried, 3);
  assert.equal(mergedShort.history.days["2026-11-21"].chars.tried, 2);
}

// theme & colorMode settings round-trip, whitelist validation, and legacy compatibility
{
  const themedBackup = H.makeBackup({
    stats: statsA,
    history: hist,
    settings: { autoNext: true, theme: "studio", colorMode: "dark" },
    exportedAt: "2026-11-21T00:00:00.000Z",
  });
  assert.deepEqual(themedBackup.settings, { autoNext: true, theme: "studio", colorMode: "dark" });
  const parsedThemed = H.parseBackup(H.backupToJson(themedBackup));
  assert.equal(parsedThemed.ok, true);
  assert.deepEqual(parsedThemed.data.settings, { autoNext: true, theme: "studio", colorMode: "dark" });

  const replacedThemed = H.applyBackup(
    { stats: statsA, history: hist, settings: { autoNext: false, theme: "ink", colorMode: "light" } },
    parsedThemed.data,
    "replace",
  );
  assert.deepEqual(replacedThemed.settings, { autoNext: true, theme: "studio", colorMode: "dark" });

  const invalidThemeParsed = H.parseBackup(JSON.stringify({
    version: 1,
    exportedAt: "2026-11-21T00:00:00.000Z",
    stats: statsA,
    history: { days: {} },
    settings: { autoNext: false, theme: "hacker-neon", colorMode: "midnight", __proto__: { polluted: 1 } },
  }));
  assert.equal(invalidThemeParsed.ok, true);
  assert.deepEqual(invalidThemeParsed.data.settings, { autoNext: false });
  assert.equal(Object.prototype.hasOwnProperty.call(invalidThemeParsed.data.settings, "theme"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(invalidThemeParsed.data.settings, "colorMode"), false);
}

// practiceStreakDays, todaySummary, and dailyGoal settings sanitization
{
  let h3 = H.emptyHistory();
  h3 = H.recordAttempt(h3, "roots", { tried: 10, ok: 9, ms: 10000 }, "2026-11-21");
  h3 = H.recordAttempt(h3, "chars", { tried: 15, ok: 12, ms: 15000 }, "2026-11-22");
  // Today (2026-11-23) not practiced yet -> keeps yesterday's 2-day streak
  assert.equal(H.practiceStreakDays(h3, "2026-11-23"), 2);
  const s0 = H.todaySummary(h3, "2026-11-23", 50);
  assert.deepEqual(s0, { tried: 0, ok: 0, ms: 0, goal: 50, pct: 0, done: false });

  // After practicing today -> 3-day streak
  h3 = H.recordAttempt(h3, "short", { tried: 25, ok: 20, ms: 20000 }, "2026-11-23");
  assert.equal(H.practiceStreakDays(h3, "2026-11-23"), 3);
  const s1 = H.todaySummary(h3, "2026-11-23", 50);
  assert.deepEqual(s1, { tried: 25, ok: 20, ms: 20000, goal: 50, pct: 50, done: false });

  // Reaching & exceeding goal caps pct at 100 and sets done=true
  h3 = H.recordAttempt(h3, "article", { tried: 40, ok: 38, ms: 40000 }, "2026-11-23");
  const s2 = H.todaySummary(h3, "2026-11-23", 50);
  assert.deepEqual(s2, { tried: 65, ok: 58, ms: 60000, goal: 50, pct: 100, done: true });

  // Gap breaks streak
  assert.equal(H.practiceStreakDays(h3, "2026-11-25"), 0);

  // sanitizeSettings accepts valid dailyGoal and rejects out-of-range
  assert.deepEqual(H.sanitizeSettings({ autoNext: false, dailyGoal: 100 }), { autoNext: false, dailyGoal: 100 });
  assert.deepEqual(H.sanitizeSettings({ autoNext: false, dailyGoal: 3 }), { autoNext: false });
  assert.deepEqual(H.sanitizeSettings({ autoNext: false, dailyGoal: 9999 }), { autoNext: false });
  assert.deepEqual(H.sanitizeSettings({ autoNext: false, sound: true }), { autoNext: false, sound: true });
}

// P3: heatmapWeeks, topWeakItems, periodDelta, personal bests & backup round-trip
{
  let h4 = H.emptyHistory();
  h4 = H.recordAttempt(h4, "chars", { tried: 120, ok: 108, ms: 60000 }, "2026-11-19");
  h4 = H.recordAttempt(h4, "roots", { tried: 25, ok: 20, ms: 25000 }, "2026-11-18");
  h4 = H.recordAttempt(h4, "chars", { tried: 10, ok: 5, ms: 10000 }, "2026-11-12");

  const cols = H.heatmapWeeks(h4, "2026-11-19", 12);
  assert.equal(cols.length, 12);
  for (const c of cols) assert.equal(c.length, 7);
  const flat = cols.flat();
  const c19 = flat.find((x) => x.date === "2026-11-19");
  const c18 = flat.find((x) => x.date === "2026-11-18");
  const c20 = flat.find((x) => x.date === "2026-11-20");
  assert.equal(c19?.level, 4);
  assert.equal(c19?.future, false);
  assert.equal(c18?.level, 2);
  assert.equal(c20?.future, true);

  const delta = H.periodDelta(h4, "2026-11-19", 7, "all");
  assert.equal(delta.triedDiff, 145 - 10);
  assert.equal(delta.accDiffPct, Math.round((128 / 145) * 100) - 50);
  const noPrev = H.periodDelta(h4, "2026-11-12", 7, "all");
  assert.deepEqual(noPrev, { triedDiff: null, accDiffPct: null });

  const weak = H.topWeakItems({ 我: 5, 的: 2 }, { "a:日": 7, "b:月": 1 }, 3);
  assert.deepEqual(
    weak.map((x) => [x.kind, x.glyph, x.sub ?? null, x.count]),
    [
      ["root", "日", "A", 7],
      ["char", "我", null, 5],
      ["char", "的", null, 2],
    ],
  );

  // Personal bests
  let b0 = H.emptyBests();
  const r1 = H.recordTimedRun(b0, { score: 18, tried: 20, diff: 100, date: "2026-11-18" });
  assert.equal(r1.isNewBest, true);
  assert.equal(r1.bests.timedBestByDiff["100"].score, 18);
  const r2 = H.recordTimedRun(r1.bests, { score: 15, tried: 20, diff: 100, date: "2026-11-19" });
  assert.equal(r2.isNewBest, false);
  assert.equal(r2.bests.timedBestByDiff["100"].score, 18);
  assert.equal(r2.bests.timedRecent.length, 2);

  const a1 = H.recordArticleRun(r2.bests, { cpm: 42, accuracy: 96, date: "2026-11-19" });
  assert.equal(a1.isNewBest, true);
  assert.equal(a1.bests.articleBestCpm?.cpm, 42);

  // Backup round-trip with bests + sound + prototype pollution guard
  const bk = H.makeBackup({
    stats: statsA,
    history: h4,
    settings: { autoNext: false, sound: true },
    bests: a1.bests,
    exportedAt: "2026-11-19T00:00:00.000Z",
  });
  const parsedBk = H.parseBackup(H.backupToJson(bk));
  assert.equal(parsedBk.ok, true);
  assert.equal(parsedBk.data.settings.sound, true);
  assert.equal(parsedBk.data.bests?.timedBestByDiff["100"]?.score, 18);
  assert.equal(parsedBk.data.bests?.articleBestCpm?.cpm, 42);

  const dirtyBests = H.sanitizeBests({
    timedBestByDiff: {
      __proto__: { score: 99, tried: 99, diff: 100, date: "2026-11-19" },
      "999": { score: 10, tried: 10, diff: 999, date: "2026-11-19" },
      "300": { score: 25, tried: 20, diff: 300, date: "2026-11-19" },
    },
    timedRecent: [{ score: 5, tried: 5, diff: 100, date: "bad-date" }],
  });
  assert.equal(Object.getPrototypeOf(dirtyBests.timedBestByDiff), null);
  assert.equal(dirtyBests.timedBestByDiff["999"], undefined);
  assert.equal(dirtyBests.timedBestByDiff["300"].score, 20);
  assert.equal(dirtyBests.timedRecent.length, 0);
}

console.log("ALL OK");
