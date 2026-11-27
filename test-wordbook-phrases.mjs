// Run: node test-wordbook-phrases.mjs
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

await Promise.all([
  build({
    entryPoints: ["src/wordbookLogic.ts"],
    bundle: true,
    format: "esm",
    outfile: "/tmp/wordbookLogic.mjs",
    logLevel: "error",
  }),
  build({
    entryPoints: ["src/phraseLogic.ts"],
    bundle: true,
    format: "esm",
    outfile: "/tmp/phraseLogic.mjs",
    logLevel: "error",
  }),
  build({
    entryPoints: ["src/historyLogic.ts"],
    bundle: true,
    format: "esm",
    outfile: "/tmp/historyLogicWb.mjs",
    logLevel: "error",
  }),
]);

const W = await import("/tmp/wordbookLogic.mjs");
const P = await import("/tmp/phraseLogic.mjs");
const H = await import("/tmp/historyLogicWb.mjs");
const table = JSON.parse(readFileSync("public/liu-table.json", "utf8"));

// ---- 1. Wordbook logic ----
assert.deepEqual(W.sanitizeWordbook(["蝦", "米", "蝦", "abc", "", 123, "  嘸 "]), ["蝦", "米", "嘸"]);

let wb = [];
let res = W.toggleWordbookChar(wb, "嘸");
assert.equal(res.added, true);
assert.deepEqual(res.next, ["嘸"]);
wb = res.next;

res = W.toggleWordbookChar(wb, "蝦");
assert.equal(res.added, true);
assert.deepEqual(res.next, ["蝦", "嘸"]);
wb = res.next;

res = W.toggleWordbookChar(wb, "嘸");
assert.equal(res.added, false);
assert.deepEqual(res.next, ["蝦"]);
wb = res.next;

const added = W.addWordbookChars(wb, ["蝦", "米", "字", "米"]);
assert.equal(added.addedCount, 2);
assert.deepEqual(added.next, ["米", "字", "蝦"]);

assert.deepEqual(W.removeWordbookChar(added.next, "字"), ["米", "蝦"]);
assert.deepEqual(W.mergeWordbook(["米", "蝦"], ["蝦", "鍵", "盤"]), ["米", "蝦", "鍵", "盤"]);

// Cap at MAX_WORDBOOK
const huge = Array.from({ length: 600 }, (_, i) => String.fromCodePoint(0x4e00 + i));
assert.equal(W.sanitizeWordbook(huge).length, W.MAX_WORDBOOK);

// ---- 2. Phrase bank & grading ----
assert.ok(P.PHRASE_BANK.length >= 200, "expected >= 200 curated phrases, got " + P.PHRASE_BANK.length);

for (const cat of ["daily", "idiom", "tech", "all"]) {
  const raw = P.filterPhrases(cat);
  const resolved = P.buildPhrasePool(cat, table);
  assert.equal(
    resolved.length,
    raw.length,
    `Every phrase in category "${cat}" must resolve in liu-table.json (resolved ${resolved.length}/${raw.length})`,
  );
  assert.ok(resolved.length >= 40, `Category "${cat}" should have >= 40 phrases`);
}

const sample = P.buildPhrasePool("daily", table).find((p) => p.text === "電腦");
assert.ok(sample, "expected 電腦 in daily pool");
assert.equal(sample.chars.length, 2);
const firstCode = sample.chars[0].k[0];
assert.deepEqual(P.gradePhraseChar(sample.chars[0], firstCode.toUpperCase()), { ok: true, usedSelect: false });
assert.deepEqual(P.gradePhraseChar(sample.chars[0], "zzzzz"), { ok: false, usedSelect: false });

// ---- 3. History + backup integration ----
assert.ok(H.DRILL_MODES.includes("phrases"), "phrases must be in DRILL_MODES");
let hist = H.emptyHistory();
hist = H.recordAttempt(hist, "phrases", { tried: 4, ok: 3, ms: 4200 }, "2026-11-27");
assert.deepEqual(hist.days["2026-11-27"].phrases, { tried: 4, ok: 3, ms: 4200 });

const backup = H.makeBackup({
  stats: H.emptyStats(),
  history: hist,
  settings: { autoNext: false },
  wordbook: ["嘸", "蝦", "米"],
});
const parsed = H.parseBackup(H.backupToJson(backup));
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.deepEqual(parsed.data.wordbook, ["嘸", "蝦", "米"]);
  assert.deepEqual(parsed.data.history.days["2026-11-27"].phrases, { tried: 4, ok: 3, ms: 4200 });

  const merged = H.applyBackup(
    { stats: H.emptyStats(), history: H.emptyHistory(), settings: { autoNext: false }, wordbook: ["鍵", "蝦"] },
    parsed.data,
    "merge",
  );
  assert.deepEqual(merged.wordbook, ["鍵", "蝦", "嘸", "米"]);

  const replaced = H.applyBackup(
    { stats: H.emptyStats(), history: H.emptyHistory(), settings: { autoNext: false }, wordbook: ["鍵"] },
    parsed.data,
    "replace",
  );
  assert.deepEqual(replaced.wordbook, ["嘸", "蝦", "米"]);
}

console.log("test-wordbook-phrases: ALL PASSED (" + P.PHRASE_BANK.length + " phrases verified)");
