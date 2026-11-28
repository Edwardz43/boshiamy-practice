// Run: node test-weakness.mjs  (bundles src/weaknessLogic.ts with esbuild)
import { build } from "esbuild";
import assert from "node:assert/strict";

await build({
  entryPoints: ["src/weaknessLogic.ts"],
  bundle: true,
  format: "esm",
  outfile: "/tmp/weaknessLogic.mjs",
  logLevel: "error",
});
const W = await import("/tmp/weaknessLogic.mjs");

// 1. decayMissMap tests
{
  const orig = { 我: 3, 的: 1, zero: 0, neg: -2 };

  // > 1 decrements by 1 without mutating original
  const r1 = W.decayMissMap(orig, "我");
  assert.equal(r1.decayed, true);
  assert.equal(r1.graduated, false);
  assert.equal(r1.next["我"], 2);
  assert.equal(orig["我"], 3, "must not mutate original map");

  // === 1 removes key cleanly
  const r2 = W.decayMissMap(orig, "的");
  assert.equal(r2.decayed, true);
  assert.equal(r2.graduated, true);
  assert.equal(Object.prototype.hasOwnProperty.call(r2.next, "的"), false);
  assert.equal(orig["的"], 1, "must not mutate original map");

  // missing / <= 0 / inherited property returns original reference unchanged
  const rMissing = W.decayMissMap(orig, "國");
  assert.equal(rMissing.decayed, false);
  assert.equal(rMissing.graduated, false);
  assert.equal(rMissing.next, orig);

  const rZero = W.decayMissMap(orig, "zero");
  assert.equal(rZero.decayed, false);
  assert.equal(rZero.graduated, false);
  assert.equal(rZero.next, orig);

  const rNeg = W.decayMissMap(orig, "neg");
  assert.equal(rNeg.decayed, false);
  assert.equal(rNeg.graduated, false);
  assert.equal(rNeg.next, orig);

  const rProto = W.decayMissMap(orig, "toString");
  assert.equal(rProto.decayed, false);
  assert.equal(rProto.graduated, false);
  assert.equal(rProto.next, orig);
}

// 2. buildKeyboardWeakness tests
{
  const charPrimaryCode = {
    回: "oov",
    天: "gnn",
    我: "ix",
    的: "d",
    日: "do",
  };

  // All 26 keys present even when empty; all level 0
  const emptyRes = W.buildKeyboardWeakness({
    missChars: {},
    missRoots: {},
    charPrimaryCode,
    mode: "all",
  });
  const keys = Object.keys(emptyRes).sort();
  assert.equal(keys.length, 26);
  assert.equal(keys[0], "a");
  assert.equal(keys[25], "z");
  for (const k of keys) {
    assert.equal(emptyRes[k].score, 0);
    assert.equal(emptyRes[k].level, 0);
    assert.deepEqual(emptyRes[k].roots, []);
    assert.deepEqual(emptyRes[k].chars, []);
  }

  // Repeated letters ("oov", "gnn") only count once per char miss; invalid keys safely skipped
  const missChars = {
    回: 2, // o, v each +2 (not o +4)
    天: 3, // g, n each +3 (not n +6)
    我: 1, // i, x each +1
    未知字: 9, // not in charPrimaryCode -> skipped safely
    bad0: 0,
    badNeg: -5,
  };
  const missRoots = {
    "d:日": 4,
    "D:刀": 2,
    "d:大": 2,
    "1:一": 5, // invalid key -> skipped
    "ab:口": 5, // multi-char key -> skipped
    "nocolon": 5, // invalid format -> skipped
    "__proto__:x": 5, // invalid key -> skipped
    "x:": 5, // empty glyph -> skipped
  };

  const allRes = W.buildKeyboardWeakness({
    missChars,
    missRoots,
    charPrimaryCode,
    mode: "all",
  });
  assert.equal(Object.keys(allRes).length, 26);
  assert.equal(allRes.o.charScore, 2);
  assert.equal(allRes.v.charScore, 2);
  assert.equal(allRes.n.charScore, 3);
  assert.equal(allRes.g.charScore, 3);
  assert.equal(allRes.d.rootScore, 8);
  assert.equal(allRes.d.score, 8);
  assert.deepEqual(allRes.d.roots, [
    { glyph: "日", count: 4 },
    { glyph: "刀", count: 2 },
    { glyph: "大", count: 2 },
  ]);

  // Mode separation: roots vs chars
  const rootsRes = W.buildKeyboardWeakness({
    missChars,
    missRoots,
    charPrimaryCode,
    mode: "roots",
  });
  assert.equal(rootsRes.d.score, 8);
  assert.equal(rootsRes.d.level, 4);
  assert.equal(rootsRes.o.score, 0);
  assert.equal(rootsRes.o.level, 0);

  const charsRes = W.buildKeyboardWeakness({
    missChars,
    missRoots,
    charPrimaryCode,
    mode: "chars",
  });
  assert.equal(charsRes.d.score, 0);
  assert.equal(charsRes.d.level, 0);
  assert.equal(charsRes.n.score, 3);
  assert.equal(charsRes.n.level, 4);

  // Level thresholds: max=4 -> 1(0.25)=>1, 2(0.5)=>2, 3(0.75)=>3, 4(1.0)=>4
  const levelRes = W.buildKeyboardWeakness({
    missChars: {},
    missRoots: {
      "a:甲": 1, // 0.25 -> 1
      "b:乙": 2, // 0.50 -> 2
      "c:丙": 3, // 0.75 -> 3
      "d:丁": 4, // 1.00 -> 4
    },
    charPrimaryCode: {},
    mode: "roots",
  });
  assert.equal(levelRes.a.level, 1);
  assert.equal(levelRes.b.level, 2);
  assert.equal(levelRes.c.level, 3);
  assert.equal(levelRes.d.level, 4);
  assert.equal(levelRes.e.level, 0);
}

console.log("test-weakness: ALL PASSED");
