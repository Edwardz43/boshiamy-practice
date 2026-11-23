// Run: node test-draw.mjs  (bundles src/drawLogic.ts with esbuild, checks CHARS in src/App.tsx)
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

await build({
  entryPoints: ["src/drawLogic.ts"],
  bundle: true,
  format: "esm",
  outfile: "/tmp/drawLogic.mjs",
  logLevel: "error",
});
const D = await import("/tmp/drawLogic.mjs");

const appSrc = readFileSync("src/App.tsx", "utf8");
const m = appSrc.match(/const CHARS: CharItem\[\] = (\[.*?\]);/);
assert.ok(m, "CHARS array not found in src/App.tsx");
const CHARS = JSON.parse(m[1]);

function makePool(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    f: Math.max(1, Math.round(10000 / (i + 1))),
  }));
}

// 1. Boundary cases
{
  const bag = D.createBag();
  assert.equal(D.drawFromBag(bag, [], (x) => x.id), null);

  const one = [{ id: "only", f: 100 }];
  for (let i = 0; i < 5; i++) {
    const picked = D.drawFromBag(bag, one, (x) => x.id);
    assert.equal(picked?.id, "only");
  }
  assert.deepEqual(bag.ids, []);
  assert.deepEqual(bag.recent, ["only"]);

  const two = [{ id: "A", f: 100 }, { id: "B", f: 25 }];
  for (const weighted of [false, true]) {
    const b2 = D.createBag();
    const seq = [];
    for (let i = 0; i < 20; i++) {
      const picked = D.drawFromBag(
        b2,
        two,
        (x) => x.id,
        weighted ? { weightOf: (x) => Math.sqrt(x.f) } : undefined,
      );
      seq.push(picked.id);
      if (i > 0) {
        assert.notEqual(seq[i], seq[i - 1], `2-item pool repeated at step ${i} (weighted=${weighted})`);
      }
    }
  }
}

// 2. Single-round zero duplication & 3. Cross-round cooldown guarantee
for (const n of [15, 36, 100, 160]) {
  const pool = makePool(n);
  const expectedMinGap = D.cooldownSize(n) + 1;
  const rounds = n === 160 ? 5 : 10;

  for (const weighted of [false, true]) {
    const bag = D.createBag();
    const lastSeen = new Map();
    for (let r = 0; r < rounds; r++) {
      const roundIds = [];
      for (let step = 0; step < n; step++) {
        const idx = r * n + step;
        const picked = D.drawFromBag(
          bag,
          pool,
          (x) => x.id,
          weighted ? { weightOf: (x) => Math.sqrt(x.f) } : undefined,
        );
        assert.ok(picked, "drawFromBag returned null for non-empty pool");
        roundIds.push(picked.id);
        if (lastSeen.has(picked.id)) {
          const gap = idx - lastSeen.get(picked.id);
          assert.ok(
            gap >= expectedMinGap,
            `n=${n} weighted=${weighted} gap=${gap} < expectedMinGap=${expectedMinGap} at idx=${idx}`,
          );
        }
        lastSeen.set(picked.id, idx);
      }
      assert.equal(new Set(roundIds).size, n, `n=${n} weighted=${weighted} round ${r} had duplicates`);
    }
  }
}

// 4. Weighted preference verification on real CHARS (diff <= 100 and diff <= 1000)
for (const [diff, minRatio] of [[100, 1.2], [1000, 2.5]]) {
  const subset = CHARS.filter((x) => x.r <= diff);
  assert.equal(subset.length, diff);
  let sumFirst20 = 0;
  let sumLast20 = 0;
  const trials = 300;
  for (let t = 0; t < trials; t++) {
    const order = D.weightedShuffle(subset, (x) => Math.sqrt(x.f));
    assert.equal(order.length, diff);
    assert.equal(new Set(order.map((x) => x.c)).size, diff);
    for (let i = 0; i < 20; i++) sumFirst20 += order[i].f;
    for (let i = diff - 20; i < diff; i++) sumLast20 += order[i].f;
  }
  const avgFirst20 = sumFirst20 / (trials * 20);
  const avgLast20 = sumLast20 / (trials * 20);
  assert.ok(
    avgFirst20 > avgLast20 * minRatio,
    `diff=${diff}: expected first 20 avg freq (${avgFirst20.toFixed(1)}) > ${minRatio}x last 20 (${avgLast20.toFixed(1)})`,
  );
}

// 5. Dynamic pool changes
{
  // (a) Mid-round shrink drops removed ids cleanly
  const pool40 = makePool(40);
  const pool20 = pool40.slice(0, 20);
  const valid20 = new Set(pool20.map((x) => x.id));
  const bag = D.createBag();
  for (let i = 0; i < 15; i++) {
    D.drawFromBag(bag, pool40, (x) => x.id, { weightOf: (x) => Math.sqrt(x.f) });
  }
  for (let i = 0; i < 60; i++) {
    const picked = D.drawFromBag(bag, pool20, (x) => x.id, { weightOf: (x) => Math.sqrt(x.f) });
    assert.ok(picked && valid20.has(picked.id), "drew an item outside shrunk pool");
  }

  // (b) Resetting bag.ids while keeping bag.recent preserves cross-switch cooldown
  const bagSwitch = D.createBag();
  const drawnBefore = [];
  for (let i = 0; i < 25; i++) {
    const p = D.drawFromBag(bagSwitch, pool40, (x) => x.id);
    drawnBefore.push(p.id);
  }
  bagSwitch.ids = [];
  const kNew = D.cooldownSize(pool20.length);
  const avoidExpected = new Set(
    bagSwitch.recent.filter((id) => valid20.has(id)).slice(-kNew),
  );
  for (let i = 0; i < kNew; i++) {
    const p = D.drawFromBag(bagSwitch, pool20, (x) => x.id);
    assert.ok(valid20.has(p.id));
    assert.ok(!avoidExpected.has(p.id), `cool-down violated after filter reset at step ${i}: ${p.id}`);
  }
}

console.log("ALL OK");
