// Pure helpers for 簡碼練習 (short-code drill), unit-testable without React.

export type ShortCharItem = {
  c: string;
  r: number;
  f: number;
  k: string[];
  a?: string[];
};

export type ShortTier = "one" | "two100" | "two300" | "all";
export type ShortGradeKind = "short" | "full" | "select" | "wrong";

export type ShortGradeResult = {
  ok: boolean;
  kind: ShortGradeKind;
  shortCodes: string[];
  fullCodes: string[];
};

export const SHORT_TIERS: { v: ShortTier; label: string; key: string; code: string }[] = [
  { v: "one", label: "一碼", key: "Q", code: "KeyQ" },
  { v: "two100", label: "二碼前100", key: "W", code: "KeyW" },
  { v: "two300", label: "二碼前300", key: "E", code: "KeyE" },
  { v: "all", label: "全部簡碼", key: "T", code: "KeyT" },
];

/** Returns true if the character has a 1-2 key short code in addition to a longer code. */
export function isShortCodeChar(item: ShortCharItem): boolean {
  const shorts = item.k.filter((x) => x.length <= 2);
  const longs = item.k.filter((x) => x.length >= 3);
  if (shorts.length === 0) return false;
  if (longs.length > 0) return true;
  return shorts[0].length === 1 && item.k.length > 1;
}

/** Returns the shortest <=2-key direct-commit code(s) for the character. */
export function shortCodesOf(item: ShortCharItem): string[] {
  const shorts = item.k.filter((x) => x.length <= 2);
  if (shorts.length === 0) return [];
  const minLen = Math.min(...shorts.map((x) => x.length));
  return shorts.filter((x) => x.length === minLen);
}

/** Returns all >=3-key direct-commit full codes for the character. */
export function fullCodesOf(item: ShortCharItem): string[] {
  return item.k.filter((x) => x.length >= 3);
}

/** Filters short-code characters by difficulty/length tier. */
export function filterShortPool<T extends ShortCharItem>(chars: T[], tier: ShortTier): T[] {
  const allShort = chars.filter(isShortCodeChar);
  if (tier === "one") {
    return allShort.filter((x) => shortCodesOf(x).some((c) => c.length === 1));
  }
  if (tier === "two100") {
    return allShort.filter((x) => x.r <= 100 && shortCodesOf(x).every((c) => c.length === 2));
  }
  if (tier === "two300") {
    return allShort.filter((x) => x.r <= 300 && shortCodesOf(x).every((c) => c.length === 2));
  }
  return allShort;
}

/** Grades a user's input strictly against short codes while distinguishing full/select codes for coaching. */
export function gradeShortAnswer(item: ShortCharItem, raw: string): ShortGradeResult {
  const code = raw.trim().toLowerCase();
  const shortCodes = shortCodesOf(item);
  const fullCodes = fullCodesOf(item);
  if (shortCodes.includes(code)) {
    return { ok: true, kind: "short", shortCodes, fullCodes };
  }
  if (fullCodes.includes(code)) {
    return { ok: false, kind: "full", shortCodes, fullCodes };
  }
  if ((item.a ?? []).includes(code)) {
    return { ok: false, kind: "select", shortCodes, fullCodes };
  }
  return { ok: false, kind: "wrong", shortCodes, fullCodes };
}

/** Returns a non-spoiler hint for 1-key short codes and a first-letter + root hint for 2-key short codes. */
export function shortHintText(item: ShortCharItem, reps: Record<string, string>): string {
  const shorts = shortCodesOf(item);
  const primary = shorts[0] ?? item.k[0] ?? "";
  const first = primary[0]?.toLowerCase() ?? "";
  const rep = first ? reps[first] : undefined;
  if (primary.length === 1) {
    return rep ? "一碼簡碼（1 鍵），該鍵代表字根：" + rep : "一碼簡碼（1 鍵）";
  }
  if (first) {
    return rep
      ? "二碼簡碼，第一碼是 " + first.toUpperCase() + "（" + rep + "）"
      : "二碼簡碼，第一碼是 " + first.toUpperCase();
  }
  return "請輸入簡碼";
}

/** Formats the display title for a short-code tier and its current question count. */
export function shortTierTitle(tier: ShortTier, count: number): string {
  if (tier === "one") return "一碼簡碼（" + count + " 字）";
  if (tier === "two100") return "二碼簡碼・前 100 常用字（" + count + " 字）";
  if (tier === "two300") return "二碼簡碼・前 300 常用字（" + count + " 字）";
  return "全部簡碼・前 1000 常用字（" + count + " 字）";
}
