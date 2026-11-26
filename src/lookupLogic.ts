// Pure helpers for 查碼 (no React), so they can be unit-tested with plain node.
// Table format (liu-table.json): { "字": "碼1 碼2|選字碼1 選字碼2" }.
//   Left of "|": codes you can type directly. Right of "|": codes where the char shows up in the candidate list (要選字).

export type Table = Record<string, string>;

export type CodeItem = { code: string; pick: boolean; shortest: boolean };
export type CharResult = { c: string; found: boolean; codes: CodeItem[] };
export type ReverseResult = { code: string; chars: { c: string; pick: boolean }[] };

const CJK = /^(?:[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[\ud840-\ud87f][\udc00-\udfff])$/;

export const MAX_CHARS = 400;

export function isCjk(ch: string): boolean {
  return CJK.test(ch);
}

/** Forward mode when the text has any Chinese char; otherwise reverse when it looks like codes. */
export function detectMode(text: string): "forward" | "reverse" | "empty" {
  if (Array.from(text).some((c) => isCjk(c))) return "forward";
  if (/[a-zA-Z]/.test(text)) return "reverse";
  return "empty";
}

export function lookupChar(table: Table, ch: string): CharResult {
  const v = table[ch];
  if (!v) return { c: ch, found: false, codes: [] };
  const [k, a] = v.split("|");
  const raw: { code: string; pick: boolean }[] = [];
  for (const code of k.split(" ")) if (code) raw.push({ code, pick: false });
  if (a) for (const code of a.split(" ")) if (code) raw.push({ code, pick: true });
  // 最短碼 compares codes you can type directly (空白鍵就出字); 要選字 codes are never flagged.
  const direct = raw.filter((x) => !x.pick);
  const minLen = Math.min(...(direct.length ? direct : raw).map((x) => x.code.length));
  const longer = raw.some((x) => x.code.length > minLen);
  const codes = raw.map((x) => ({ ...x, shortest: longer && !x.pick && x.code.length === minLen }));
  return { c: ch, found: true, codes };
}

/** Each distinct Chinese char once, in order of first appearance. Punctuation, spaces and Latin are skipped. */
export function lookupText(table: Table, text: string): { results: CharResult[]; truncated: boolean; total: number } {
  const seen = new Set<string>();
  const out: CharResult[] = [];
  let truncated = false;
  for (const ch of Array.from(text)) {
    if (!isCjk(ch) && !table[ch]) continue;
    if (seen.has(ch)) continue;
    seen.add(ch);
    if (out.length >= MAX_CHARS) {
      truncated = true;
      continue;
    }
    out.push(lookupChar(table, ch));
  }
  return { results: out, truncated, total: seen.size };
}

export type ReverseIndex = Map<string, { c: string; pick: boolean }[]>;

export function buildReverse(table: Table): ReverseIndex {
  const idx: ReverseIndex = new Map();
  for (const [ch, v] of Object.entries(table)) {
    const [k, a] = v.split("|");
    const add = (codes: string | undefined, pick: boolean): void => {
      if (!codes) return;
      for (const code of codes.split(" ")) {
        if (!code) continue;
        const list = idx.get(code);
        if (list) list.push({ c: ch, pick });
        else idx.set(code, [{ c: ch, pick }]);
      }
    };
    add(k, false);
    add(a, true);
  }
  return idx;
}

/** Split input like "ab, cd" into codes; letters (and the table's . and ' keys) only, lower-cased, de-duplicated, at most 12. */
export function parseCodes(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of text.toLowerCase().split(/[^a-z.']+/)) {
    const code = t;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
    if (out.length >= 12) break;
  }
  return out;
}

export function lookupCode(idx: ReverseIndex, code: string): ReverseResult {
  const list = idx.get(code) ?? [];
  // Direct codes first, then the 要選字 ones.
  const sorted = [...list].sort((x, y) => Number(x.pick) - Number(y.pick));
  return { code, chars: sorted };
}

// ---- 繁簡對照 (OpenCC TSCharacters / STCharacters, built into public/opencc-chars.json) ----
export type Variants = { t2s: Record<string, string[]>; s2t: Record<string, string[]> };
export type VariantGroup = { kind: "simp" | "trad"; items: CharResult[] };

/** Other-script forms of one char: its 簡體 forms (if it is 繁體) and its 繁體 forms (if it is 簡體). One-to-many lists all. */
export function variantsOf(table: Table, vars: Variants | null, ch: string): VariantGroup[] {
  if (!vars) return [];
  const out: VariantGroup[] = [];
  const s = vars.t2s[ch];
  if (s && s.length) out.push({ kind: "simp", items: s.map((x) => lookupChar(table, x)) });
  const t = vars.s2t[ch];
  if (t && t.length) out.push({ kind: "trad", items: t.map((x) => lookupChar(table, x)) });
  return out;
}

export type RubyToken = {
  c: string;
  isBreak: boolean;
  isCjk: boolean;
  code: string | null;
  found: boolean;
  pick: boolean;
};

/** Tokenize text in original order for Ruby-style lookup view (one shortest direct code per CJK char). */
export function lookupTokens(table: Table, text: string): { tokens: RubyToken[]; cjkCount: number; truncated: boolean } {
  const tokens: RubyToken[] = [];
  let cjkCount = 0;
  let truncated = false;
  for (const raw of Array.from(text)) {
    if (raw === "\r") continue;
    if (raw === "\n") {
      tokens.push({ c: "\n", isBreak: true, isCjk: false, code: null, found: false, pick: false });
      continue;
    }
    const cjk = isCjk(raw) || !!table[raw];
    if (!cjk) {
      tokens.push({ c: raw, isBreak: false, isCjk: false, code: null, found: false, pick: false });
      continue;
    }
    cjkCount += 1;
    if (cjkCount > MAX_CHARS) {
      truncated = true;
      continue;
    }
    const res = lookupChar(table, raw);
    if (!res.found || res.codes.length === 0) {
      tokens.push({ c: raw, isBreak: false, isCjk: true, code: null, found: false, pick: false });
      continue;
    }
    const direct = res.codes.filter((x) => !x.pick);
    const pool = direct.length ? direct : res.codes;
    let best = pool[0];
    for (const item of pool) {
      if (item.code.length < best.code.length) best = item;
    }
    tokens.push({
      c: raw,
      isBreak: false,
      isCjk: true,
      code: best.code,
      found: true,
      pick: best.pick,
    });
  }
  return { tokens, cjkCount, truncated };
}
