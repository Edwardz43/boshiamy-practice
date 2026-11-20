// Run: node test-short.mjs  (bundles src/shortLogic.ts with esbuild, checks CHARS in src/App.tsx)
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

await build({
  entryPoints: ["src/shortLogic.ts"],
  bundle: true,
  format: "esm",
  outfile: "/tmp/shortLogic.mjs",
  logLevel: "error",
});
const S = await import("/tmp/shortLogic.mjs");

const appSrc = readFileSync("src/App.tsx", "utf8");
const m = appSrc.match(/const CHARS: CharItem\[\] = (\[.*?\]);/);
assert.ok(m, "CHARS array not found in src/App.tsx");
const CHARS = JSON.parse(m[1]);
const byChar = new Map(CHARS.map((x) => [x.c, x]));

const one = S.filterShortPool(CHARS, "one");
const two100 = S.filterShortPool(CHARS, "two100");
const two300 = S.filterShortPool(CHARS, "two300");
const all = S.filterShortPool(CHARS, "all");

assert.equal(one.length, 15);
assert.equal(two100.length, 36);
assert.equal(two300.length, 88);
assert.equal(all.length, 325);

for (const item of all) {
  assert.ok(S.shortCodesOf(item).length >= 1, "missing short code: " + item.c);
  assert.ok(S.fullCodesOf(item).length >= 1, "missing full code: " + item.c);
}

// 的: short=d, full=pdna
const de = byChar.get("的");
assert.ok(de);
assert.deepEqual(S.shortCodesOf(de), ["d"]);
assert.deepEqual(S.fullCodesOf(de), ["pdna"]);
assert.deepEqual(S.gradeShortAnswer(de, "D"), { ok: true, kind: "short", shortCodes: ["d"], fullCodes: ["pdna"] });
assert.deepEqual(S.gradeShortAnswer(de, "pdna"), { ok: false, kind: "full", shortCodes: ["d"], fullCodes: ["pdna"] });
assert.deepEqual(S.gradeShortAnswer(de, "zz"), { ok: false, kind: "wrong", shortCodes: ["d"], fullCodes: ["pdna"] });

// 是: short=jn, full=dez
const shi = byChar.get("是");
assert.ok(shi);
assert.equal(S.gradeShortAnswer(shi, "jn").ok, true);
assert.equal(S.gradeShortAnswer(shi, "jn").kind, "short");
assert.equal(S.gradeShortAnswer(shi, "dez").ok, false);
assert.equal(S.gradeShortAnswer(shi, "dez").kind, "full");

// 為: short=bf, full=bwf/ewf/uwf, select=wa
const wei = byChar.get("為");
assert.ok(wei);
assert.equal(S.gradeShortAnswer(wei, "bf").kind, "short");
assert.equal(S.gradeShortAnswer(wei, "bf").ok, true);
assert.equal(S.gradeShortAnswer(wei, "bwf").kind, "full");
assert.equal(S.gradeShortAnswer(wei, "bwf").ok, false);
assert.equal(S.gradeShortAnswer(wei, "wa").kind, "select");
assert.equal(S.gradeShortAnswer(wei, "wa").ok, false);

const reps = { d: "日 大 刀 的", j: "十 扌" };
const hintDe = S.shortHintText(de, reps);
assert.ok(!/[a-z]/i.test(hintDe), "1-key hint leaked letter: " + hintDe);
assert.ok(hintDe.includes("日 大 刀 的"), "1-key hint missing roots: " + hintDe);

const hintShi = S.shortHintText(shi, reps);
assert.ok(hintShi.includes("J"), "2-key hint missing first letter: " + hintShi);

console.log("ALL OK");
