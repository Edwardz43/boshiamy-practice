// Run: node test-lookup.mjs  (bundles src/lookupLogic.ts with esbuild, checks against public/*.json)
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
await build({ entryPoints: ["src/lookupLogic.ts"], bundle: true, format: "esm", outfile: "/tmp/lookupLogic.mjs", logLevel: "error" });
const L = await import("/tmp/lookupLogic.mjs");
const table = JSON.parse(readFileSync("public/liu-table.json", "utf8"));
const vars = JSON.parse(readFileSync("public/opencc-chars.json", "utf8"));
const codes = (c) => L.lookupChar(table, c).codes.map((x) => x.code + (x.pick ? "*" : "") + (x.shortest ? "!" : ""));

const expect = { 我: "ix", 的: "d pdna", 嘸: "oek ovff|ogl", 蝦: "cfa cox cofu", 米: "mn" };
for (const [c, raw] of Object.entries(expect)) {
  assert.equal(table[c], raw);
  const [k, a] = raw.split("|");
  const want = [...k.split(" "), ...(a ? a.split(" ") : [])];
  assert.deepEqual(L.lookupChar(table, c).codes.map((x) => x.code), want);
  console.log(c, codes(c).join(" "));
}
assert.ok(L.lookupChar(table, "的").codes.find((x) => x.code === "d").shortest);
assert.ok(!L.lookupChar(table, "我").codes[0].shortest); // single code: nothing to compare
assert.ok(!L.lookupChar(table, "嘸").codes.find((x) => x.code === "ogl").shortest);
assert.ok(L.lookupChar(table, "嘸").codes.find((x) => x.code === "oek").shortest);
assert.equal(L.lookupChar(table, "龘龘龘").found, false);

// text: punctuation / spaces / latin skipped, duplicates once, unknown CJK -> 查無
const t = L.lookupText(table, "我，的 abc 嘸蝦米！我");
assert.deepEqual(t.results.map((r) => r.c), ["我", "的", "嘸", "蝦", "米"]);
const t2 = L.lookupText(table, "我𠀀");
console.log("ext-B char found:", t2.results.map((r) => r.c + ":" + r.found).join(" "));

// detect + reverse
assert.equal(L.detectMode("ab"), "reverse");
assert.equal(L.detectMode("我 ab"), "forward");
assert.equal(L.detectMode("，。 "), "empty");
const idx = L.buildReverse(table);
const ab = L.lookupCode(idx, "ab").chars.map((x) => x.c + (x.pick ? "*" : ""));
console.log("ab ->", ab.join(" "));
assert.ok(ab.length > 0);
for (const x of L.lookupCode(idx, "ab").chars) assert.ok(table[x.c].split(/[ |]/).includes("ab"));
// every reverse hit must round-trip, and every code of 我/的/嘸/蝦/米 reverse-finds the char
for (const c of Object.keys(expect)) for (const x of L.lookupChar(table, c).codes) assert.ok(L.lookupCode(idx, x.code).chars.some((y) => y.c === c));
assert.deepEqual(L.parseCodes("AB, cd ab  e.f"), ["ab", "cd", "e.f"]);
assert.deepEqual(L.lookupCode(idx, "zzzzzzz").chars, []);

// 繁簡
const show = (c) => L.variantsOf(table, vars, c).map((g) => g.kind + ":" + g.items.map((i) => i.c + "=" + (i.found ? i.codes.map((x) => x.code).join("/") : "查無")).join(",")).join(" ; ");
for (const c of ["蝦", "虾", "發", "发", "髮", "高", "干", "乾", "龍", "龙", "麼", "么"]) console.log("variants", c, "=>", show(c) || "(無差異)");
assert.equal(show("高"), "");
assert.deepEqual(L.variantsOf(table, vars, "蝦").map((g) => [g.kind, g.items.map((i) => i.c)]), [["simp", ["虾"]]]);
assert.deepEqual(L.variantsOf(table, vars, "發")[0].items.map((i) => i.c), ["发"]);
assert.deepEqual(L.variantsOf(table, vars, "发")[0].items.map((i) => i.c), ["發", "髮"]); // one-to-many
assert.equal(L.variantsOf(table, vars, "虾")[0].kind, "trad");
assert.equal(L.variantsOf(table, null, "蝦").length, 0);
// 簡體字若碼表沒有 -> 查無
const miss = Object.keys(vars.t2s).filter((t) => vars.t2s[t].some((s) => !table[s]));
console.log("traditional chars with a simplified form missing from table:", miss.length, miss.slice(0, 8).join(""));

// P3: lookupTokens (Ruby view tokenization)
const rt = L.lookupTokens(table, "我的，\n発!");
assert.equal(rt.cjkCount, 3);
assert.equal(rt.truncated, false);
assert.deepEqual(
  rt.tokens.map((x) => (x.isBreak ? "\\n" : x.isCjk ? x.c + ":" + (x.found ? x.code : "?") : x.c)),
  ["我:ix", "的:d", "，", "\\n", "発:?", "!"],
);
console.log("ALL OK");
