// Run: node test-simplified.mjs  (bundles src/simplifiedLogic.ts with esbuild, checks against CHARS + public/*.json)
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

await build({
  entryPoints: ["src/simplifiedLogic.ts"],
  bundle: true,
  format: "esm",
  outfile: "/tmp/simplifiedLogic.mjs",
  logLevel: "error",
});
await build({
  entryPoints: ["src/simplifiedData.ts"],
  bundle: true,
  format: "esm",
  outfile: "/tmp/simplifiedData.mjs",
  logLevel: "error",
});

const S = await import("/tmp/simplifiedLogic.mjs");
const D = await import("/tmp/simplifiedData.mjs");

const appSrc = readFileSync("src/App.tsx", "utf8");
const m = appSrc.match(/const CHARS: CharItem\[\] = (\[.*?\]);/);
assert.ok(m, "CHARS array not found in src/App.tsx");
const CHARS = JSON.parse(m[1]);
const byChar = new Map(CHARS.map((x) => [x.c, x]));
const table = JSON.parse(readFileSync("public/liu-table.json", "utf8"));
const vars = JSON.parse(readFileSync("public/opencc-chars.json", "utf8"));

// 1) Exhaustively validate SIMPLIFIED_CODE_MAP against CHARS and OpenCC t2s
const entries = Object.entries(D.SIMPLIFIED_CODE_MAP);
assert.ok(entries.length >= 200, "expected >= 200 entries in SIMPLIFIED_CODE_MAP");

for (const ch of ["內", "別", "戶", "稅", "搖"]) {
  assert.equal(D.SIMPLIFIED_CODE_MAP[ch], undefined, ch + " should be excluded as trivial stroke variant");
  assert.deepEqual(S.getSimplifiedHints(ch, table, vars), [], ch + " should return [] even with table fallback");
}

for (const [ch, list] of entries) {
  const item = byChar.get(ch);
  assert.ok(item, "missing CHARS entry for " + ch);
  assert.ok(list.length > 0, "empty hint list for " + ch);
  const t2s = vars.t2s[ch] ?? [];
  for (const [simp, directCodes, selectCodes] of list) {
    assert.ok(t2s.includes(simp), `${ch} -> ${simp} not found in OpenCC t2s`);
    assert.ok(directCodes.length > 0 || selectCodes.length > 0, `${ch} -> ${simp} has no codes`);
    for (const c of directCodes) {
      assert.ok(item.k.includes(c), `${ch} direct code ${c} missing from CHARS.k (${item.k.join("/")})`);
    }
    for (const c of selectCodes) {
      assert.ok((item.a ?? []).includes(c), `${ch} select code ${c} missing from CHARS.a`);
    }
  }
}

// 2) Verify representative cases
assert.deepEqual(S.getSimplifiedHints("國"), [{ simp: "国", directCodes: ["oka"], selectCodes: [] }]);
assert.deepEqual(S.getSimplifiedHints("體"), [{ simp: "体", directCodes: [], selectCodes: ["pte"] }]);
assert.deepEqual(S.getSimplifiedHints("對"), [{ simp: "对", directCodes: [], selectCodes: ["uaa"] }]);
assert.deepEqual(S.getSimplifiedHints("時"), [{ simp: "时", directCodes: [], selectCodes: ["daa"] }]);
assert.deepEqual(S.getSimplifiedHints("這"), [{ simp: "这", directCodes: [], selectCodes: ["wwn"] }]);
assert.deepEqual(S.getSimplifiedHints("學"), [{ simp: "学", directCodes: ["snz"], selectCodes: [] }]);
assert.deepEqual(S.getSimplifiedHints("總"), [{ simp: "总", directCodes: ["boh"], selectCodes: [] }]);
assert.deepEqual(S.getSimplifiedHints("覺"), [{ simp: "觉", directCodes: ["snmr"], selectCodes: [] }]);
assert.deepEqual(S.getSimplifiedHints("電"), [{ simp: "电", directCodes: ["iql"], selectCodes: [] }]);
assert.deepEqual(S.getSimplifiedHints("經"), [{ simp: "经", directCodes: ["sui"], selectCodes: [] }]);
assert.deepEqual(S.getSimplifiedHints("關"), [{ simp: "关", directCodes: [], selectCodes: ["bed", "bgn"] }]);

// Non-related simplified variants or characters without simplified forms return []
for (const ch of ["臺", "高", "我", "記", "內", "戶"]) {
  assert.deepEqual(S.getSimplifiedHints(ch, table, vars), [], `${ch} should have no simplified-code hint`);
}

// 3) Fallback table lookup for non-top-1000 chars (used by ArticleMode)
assert.equal(byChar.has("傑"), false, "傑 should be outside top-1000 CHARS");
assert.deepEqual(S.getSimplifiedHints("傑", table, vars), [{ simp: "杰", directCodes: [], selectCodes: ["tfa"] }]);

// 4) Root formatting helper
assert.equal(
  S.formatCodeRoots("oka", { o: "口 囗 〇", k: "九 王 斤 黃", a: "亼 金 寸 丶" }),
  "O 口 囗 〇；K 九 王 斤 黃；A 亼 金 寸 丶",
);

console.log("SIMPLIFIED LOGIC ALL OK (" + entries.length + " mapped chars)");
