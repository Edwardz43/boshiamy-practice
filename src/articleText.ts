// Pure helpers for 文章練習 (no React), so they can be unit-tested with plain node.

export type Seg = { c: string; k?: string[]; a?: string[] };
export type Article = { title: string; url: string; segs: Seg[]; codable: number };
export type Table = Record<string, string>;

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[\ud840-\ud87f][\udc00-\udfff]/;
const MIN_CODABLE = 30;
const GOOD_CODABLE = 60;
const MAX_CODABLE = 150;

export function lookup(table: Table, ch: string): { k: string[]; a?: string[] } | null {
  const v = table[ch];
  if (!v) return null;
  const [k, a] = v.split("|");
  return a ? { k: k.split(" "), a: a.split(" ") } : { k: k.split(" ") };
}

function isCjk(ch: string): boolean {
  return CJK.test(ch);
}

/** Clean an intro extract and cut it to at most MAX_CODABLE codable chars. */
export function prepareText(extract: string, table: Table): { text: string; codable: number; cjkRatio: number } {
  let t = extract.replace(/\r/g, "");
  // Join lines; drop spaces between CJK chars, keep single spaces elsewhere.
  t = t.replace(/\s*\n+\s*/g, "").replace(/[ \t\u00a0\u3000]+/g, " ");
  t = t.replace(/(\S) (?=\S)/g, (m, a: string, off: number) => {
    const next = t[off + 2] ?? "";
    return isCjk(a) || isCjk(next) ? a : m;
  });
  // Remove parentheticals that are mostly non-Chinese (英語：…, romanisations, dates in Latin).
  for (let i = 0; i < 3; i++) {
    t = t.replace(/[（(][^（）()]{0,120}[）)]/g, (m) => {
      const inner = Array.from(m.slice(1, -1));
      const cjk = inner.filter(isCjk).length;
      return inner.length === 0 || cjk / inner.length < 0.5 ? "" : m;
    });
  }
  t = t.replace(/\s+([，。、；：！？])/g, "$1").trim();
  const chars = Array.from(t);
  // Cut at sentence end once we have enough; hard cut at MAX_CODABLE.
  let n = 0;
  let cut = chars.length;
  let lastEnd = -1;
  for (let i = 0; i < chars.length; i++) {
    if (table[chars[i]]) n++;
    if ("。！？；".includes(chars[i])) {
      lastEnd = i;
      if (n >= 100) {
        cut = i + 1;
        break;
      }
    }
    if (n >= MAX_CODABLE) {
      cut = lastEnd >= 0 && lastEnd > i - 60 ? lastEnd + 1 : i + 1;
      break;
    }
  }
  let out = chars.slice(0, cut).join("");
  if (cut < chars.length && !"。！？；".includes(chars[cut - 1])) out += "…";
  const outChars = Array.from(out);
  const codable = outChars.filter((c) => !!table[c]).length;
  const cjk = outChars.filter(isCjk).length;
  const alnum = outChars.filter((c) => /[A-Za-z0-9\u00c0-\u024f]/.test(c)).length;
  return { text: out, codable, cjkRatio: cjk + alnum === 0 ? 0 : cjk / (cjk + alnum) };
}

export function toSegs(text: string, table: Table): Seg[] {
  return Array.from(text).map((c) => {
    const e = lookup(table, c);
    return e ? { c, ...e } : { c };
  });
}

type WikiPage = {
  title: string;
  extract?: string;
  pageprops?: Record<string, string>;
  varianttitles?: Record<string, string>;
  missing?: boolean;
};

export function pickArticle(pages: WikiPage[], table: Table, rand: () => number = Math.random): Article | null {
  const good: Article[] = [];
  const ok: Article[] = [];
  for (const p of pages) {
    if (!p || p.missing || !p.extract) continue;
    if (p.pageprops && "disambiguation" in p.pageprops) continue;
    const title = (p.varianttitles && p.varianttitles["zh-tw"]) || p.title;
    if (/列表|消歧義|年表$/.test(title)) continue;
    const prep = prepareText(p.extract, table);
    if (prep.codable < MIN_CODABLE || prep.cjkRatio < 0.7) continue;
    const art: Article = {
      title,
      url: "https://zh.wikipedia.org/zh-tw/" + encodeURIComponent(p.title.replace(/ /g, "_")),
      segs: toSegs(prep.text, table),
      codable: prep.codable,
    };
    (prep.codable >= GOOD_CODABLE ? good : ok).push(art);
  }
  const list = good.length ? good : ok;
  if (!list.length) return null;
  return list[Math.floor(rand() * list.length)];
}

export const WIKI_URL =
  "https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*" +
  "&generator=random&grnnamespace=0&grnlimit=10" +
  "&prop=extracts%7Cpageprops%7Cinfo&inprop=varianttitles&ppprop=disambiguation" +
  "&exintro=1&explaintext=1&exlimit=10&variant=zh-tw";
