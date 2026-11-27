// Pure helpers for the custom Wordbook (生字本), unit-testable without React.

export const WORDBOOK_KEY = "boshiamy-wordbook-v1";
export const MAX_WORDBOOK = 500;

const CJK_CHAR = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|^[\ud840-\ud87f][\udc00-\udfff]$/;

function normalizeChar(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const first = Array.from(trimmed)[0];
  if (!first || first.length > 2) return null;
  if (!CJK_CHAR.test(first)) return null;
  return first;
}

/** Validate, deduplicate (preserving order), and cap a wordbook character list. */
export function sanitizeWordbook(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const ch = normalizeChar(item);
    if (!ch || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
    if (out.length >= MAX_WORDBOOK) break;
  }
  return out;
}

/** Toggle a character in the wordbook (prepends when adding so newest appears first). */
export function toggleWordbookChar(list: string[], raw: string): { next: string[]; added: boolean } {
  const ch = normalizeChar(raw);
  if (!ch) return { next: list, added: false };
  if (list.includes(ch)) {
    return { next: list.filter((x) => x !== ch), added: false };
  }
  return { next: [ch, ...list].slice(0, MAX_WORDBOOK), added: true };
}

/** Add multiple characters to the front of the wordbook without duplicates. */
export function addWordbookChars(list: string[], chars: string[]): { next: string[]; addedCount: number } {
  const existing = new Set(list);
  const toAdd: string[] = [];
  for (const raw of chars) {
    const ch = normalizeChar(raw);
    if (!ch || existing.has(ch)) continue;
    existing.add(ch);
    toAdd.push(ch);
  }
  if (toAdd.length === 0) return { next: list, addedCount: 0 };
  return {
    next: [...toAdd, ...list].slice(0, MAX_WORDBOOK),
    addedCount: toAdd.length,
  };
}

/** Remove a single character from the wordbook. */
export function removeWordbookChar(list: string[], ch: string): string[] {
  return list.filter((x) => x !== ch);
}

/** Merge two wordbooks (preserving order of `a`, then appending unseen items from `b`). */
export function mergeWordbook(a: string[], b: string[]): string[] {
  return sanitizeWordbook([...a, ...b]);
}

export function loadWordbookFromStorage(getItem: (k: string) => string | null): string[] {
  try {
    const raw = getItem(WORDBOOK_KEY);
    if (!raw) return [];
    return sanitizeWordbook(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveWordbookToStorage(setItem: (k: string, v: string) => void, list: string[]): void {
  setItem(WORDBOOK_KEY, JSON.stringify(sanitizeWordbook(list)));
}
