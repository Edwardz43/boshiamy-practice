// Pure helpers for weakness decay and 26-key weakness heatmap (no React), unit-testable with esbuild + node.

export type HeatmapMode = "all" | "roots" | "chars";

export type KeyWeakEntry = {
  key: string;
  score: number;
  level: 0 | 1 | 2 | 3 | 4;
  rootScore: number;
  charScore: number;
  roots: { glyph: string; count: number }[];
  chars: { c: string; code: string; count: number }[];
};

export const QWERTY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

/**
 * Decay a miss counter by 1 when answered correctly.
 * Deletes the key cleanly when reaching 0 so no 0-count keys linger.
 */
export function decayMissMap(
  map: Record<string, number>,
  key: string,
): { next: Record<string, number>; decayed: boolean; graduated: boolean } {
  if (!Object.prototype.hasOwnProperty.call(map, key)) {
    return { next: map, decayed: false, graduated: false };
  }
  const cur = map[key];
  if (typeof cur !== "number" || !Number.isFinite(cur) || cur <= 0) {
    return { next: map, decayed: false, graduated: false };
  }
  const next: Record<string, number> = { ...map };
  if (cur > 1) {
    next[key] = cur - 1;
    return { next, decayed: true, graduated: false };
  }
  delete next[key];
  return { next, decayed: true, graduated: true };
}

/**
 * Compute per-key (a-z) weakness scores, heatmap levels (0-4),
 * and broken-down weak roots / characters for the History page heatmap.
 */
export function buildKeyboardWeakness(params: {
  missChars: Record<string, number>;
  missRoots: Record<string, number>;
  charPrimaryCode: Record<string, string>;
  mode: HeatmapMode;
}): Record<string, KeyWeakEntry> {
  const out: Record<string, KeyWeakEntry> = {};
  const rootMaps: Record<string, Map<string, number>> = {};

  for (const k of ALPHABET) {
    out[k] = {
      key: k,
      score: 0,
      level: 0,
      rootScore: 0,
      charScore: 0,
      roots: [],
      chars: [],
    };
    rootMaps[k] = new Map();
  }

  for (const [id, count] of Object.entries(params.missRoots)) {
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) continue;
    const colon = id.indexOf(":");
    if (colon <= 0) continue;
    const k = id.slice(0, colon).trim().toLowerCase();
    const glyph = id.slice(colon + 1);
    if (!/^[a-z]$/.test(k) || !glyph) continue;
    out[k].rootScore += count;
    const gMap = rootMaps[k];
    gMap.set(glyph, (gMap.get(glyph) ?? 0) + count);
  }

  for (const [ch, count] of Object.entries(params.missChars)) {
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) continue;
    if (!Object.prototype.hasOwnProperty.call(params.charPrimaryCode, ch)) continue;
    const rawCode = params.charPrimaryCode[ch];
    if (typeof rawCode !== "string" || !rawCode.trim()) continue;
    const code = rawCode.trim().toLowerCase();
    const seenLetters = new Set<string>();
    for (const letter of code) {
      if (letter >= "a" && letter <= "z") {
        seenLetters.add(letter);
      }
    }
    for (const k of seenLetters) {
      out[k].charScore += count;
      out[k].chars.push({ c: ch, code, count });
    }
  }

  let maxScore = 0;
  for (const k of ALPHABET) {
    const entry = out[k];
    entry.roots = Array.from(rootMaps[k].entries())
      .map(([glyph, count]) => ({ glyph, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.glyph.localeCompare(b.glyph)));
    entry.chars.sort((a, b) => (b.count !== a.count ? b.count - a.count : a.c.localeCompare(b.c)));
    entry.score =
      params.mode === "roots"
        ? entry.rootScore
        : params.mode === "chars"
          ? entry.charScore
          : entry.rootScore + entry.charScore;
    if (entry.score > maxScore) maxScore = entry.score;
  }

  for (const k of ALPHABET) {
    const entry = out[k];
    if (entry.score <= 0 || maxScore <= 0) {
      entry.level = 0;
      continue;
    }
    const ratio = entry.score / maxScore;
    if (ratio <= 0.25) entry.level = 1;
    else if (ratio <= 0.5) entry.level = 2;
    else if (ratio <= 0.75) entry.level = 3;
    else entry.level = 4;
  }

  return out;
}
