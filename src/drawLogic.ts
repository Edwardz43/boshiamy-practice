// Shuffle-bag drawing with weighted permutation and cross-round cooldown.

export type DrawBag = {
  ids: string[];
  recent: string[];
};

export type DrawOptions<T> = {
  weightOf?: (item: T) => number;
  maxCooldown?: number;
  rand?: () => number;
};

export const MAX_COOLDOWN = 20;

export function createBag(): DrawBag {
  return { ids: [], recent: [] };
}

export function cooldownSize(n: number, maxCooldown = MAX_COOLDOWN): number {
  if (n <= 1 || maxCooldown <= 0) return 0;
  return Math.min(maxCooldown, Math.floor(n / 2));
}

export function shuffle<T>(list: readonly T[], rand: () => number = Math.random): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Efraimidis-Spirakis weighted without-replacement permutation (exponential racing).
 * Higher-weight items tend to appear earlier in the round while every item appears once.
 */
export function weightedShuffle<T>(
  list: readonly T[],
  weightOf: (item: T) => number,
  rand: () => number = Math.random,
): T[] {
  const keyed = list.map((item) => {
    const u = Math.min(Math.max(rand(), 1e-12), 1 - 1e-12);
    const rawW = weightOf(item);
    const w = Number.isFinite(rawW) && rawW > 0 ? rawW : 1;
    return { item, key: -Math.log(u) / w };
  });
  keyed.sort((a, b) => a.key - b.key);
  return keyed.map((entry) => entry.item);
}

/**
 * Ensures none of the first `k` draws (`order[0..k-1]`) belong to `avoid`
 * by swapping violating early positions with randomly chosen safe tail positions (`>= k`).
 * Because `avoid.size <= k <= Math.floor(order.length / 2)`, enough safe positions always exist.
 */
function applyBoundaryCooldown(
  order: string[],
  avoid: Set<string>,
  k: number,
  rand: () => number,
): string[] {
  if (k <= 0 || avoid.size === 0) return order;
  const out = order.slice();
  const safeTail: number[] = [];
  for (let j = k; j < out.length; j++) {
    if (!avoid.has(out[j])) safeTail.push(j);
  }
  const shuffledTail = shuffle(safeTail, rand);
  let t = 0;
  for (let i = 0; i < k && i < out.length; i++) {
    if (avoid.has(out[i]) && t < shuffledTail.length) {
      const j = shuffledTail[t++];
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
  }
  return out;
}

export function drawFromBag<T>(
  bag: DrawBag,
  list: readonly T[],
  idOf: (item: T) => string,
  options?: DrawOptions<T>,
): T | null {
  if (list.length === 0) return null;
  if (list.length === 1) {
    const onlyId = idOf(list[0]);
    bag.ids = [];
    bag.recent = [onlyId];
    return list[0];
  }

  const maxCooldown = options?.maxCooldown ?? MAX_COOLDOWN;
  const rand = options?.rand ?? Math.random;
  const byId = new Map<string, T>(list.map((item) => [idOf(item), item] as const));

  // Drop ids no longer in the pool (filters or review list changed).
  bag.ids = bag.ids.filter((id) => byId.has(id));

  if (bag.ids.length === 0) {
    const k = cooldownSize(list.length, maxCooldown);
    const avoid =
      k > 0 ? new Set(bag.recent.filter((id) => byId.has(id)).slice(-k)) : new Set<string>();
    const ordered = options?.weightOf
      ? weightedShuffle(list, options.weightOf, rand)
      : shuffle(list, rand);
    const cooledOrder = applyBoundaryCooldown(ordered.map(idOf), avoid, k, rand);
    // Reverse so pop() yields cooledOrder[0], cooledOrder[1], ...
    bag.ids = cooledOrder.reverse();
  }

  const id = bag.ids.pop() as string;
  bag.recent = maxCooldown > 0 ? [...bag.recent, id].slice(-maxCooldown) : [];
  return byId.get(id) ?? null;
}
