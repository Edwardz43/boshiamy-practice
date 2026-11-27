// Pure helpers and curated Taiwan phrase/idiom bank for 詞彙連打 (no React).

import { lookup, type Table } from "./articleText";

export type PhraseCategory = "daily" | "idiom" | "tech" | "all";

export type PhraseItem = {
  text: string;
  cat: Exclude<PhraseCategory, "all">;
};

export type ResolvedChar = {
  c: string;
  k: string[];
  a?: string[];
};

export type ResolvedPhrase = {
  text: string;
  cat: Exclude<PhraseCategory, "all">;
  chars: ResolvedChar[];
};

export const PHRASE_CATEGORIES: { v: PhraseCategory; label: string; shortLabel: string }[] = [
  { v: "daily", label: "日常雙字詞", shortLabel: "日常詞" },
  { v: "idiom", label: "四字成語", shortLabel: "成語" },
  { v: "tech", label: "科技與職場", shortLabel: "科技職場" },
  { v: "all", label: "全部詞彙", shortLabel: "全部" },
];

const DAILY_WORDS: string[] = [
  "電腦", "手機", "軟體", "硬體", "鍵盤", "螢幕", "滑鼠", "耳機",
  "高鐵", "捷運", "車站", "機場", "護照", "行李", "飯店", "地圖",
  "路線", "交通", "上班", "下班", "休假", "週末", "同事", "主管",
  "客戶", "會議", "專案", "進度", "目標", "效率", "系統", "資料",
  "安全", "網路", "學習", "練習", "習慣", "時間", "方向", "問題",
  "解決", "思考", "整理", "溝通", "合作", "分享", "紀錄", "備份",
  "更新", "版本", "功能", "體驗", "介面", "細節", "穩定", "速度",
  "節奏", "流暢", "專注", "耐心", "堅持", "突破", "進步", "挑戰",
  "天氣", "溫度", "微風", "陽光", "散步", "旅行", "風景", "美食",
  "餐廳", "夜市", "便當", "咖啡", "早餐", "午餐", "晚餐", "水果",
  "健康", "運動", "跑步", "游泳", "睡眠", "飲食", "閱讀", "音樂",
  "電影", "書籍", "筆記", "靈感", "創意", "設計", "品質", "信任",
  "感謝", "祝福", "快樂", "輕鬆", "安心", "自然", "溫暖", "從容",
];

const IDIOM_WORDS: string[] = [
  "一舉兩得", "事半功倍", "循序漸進", "持之以恆", "熟能生巧", "水到渠成",
  "一氣呵成", "融會貫通", "得心應手", "遊刃有餘", "日積月累", "集思廣益",
  "精益求精", "實事求是", "一目瞭然", "井然有序", "有條不紊", "臨危不亂",
  "胸有成竹", "迎刃而解", "駕輕就熟", "舉一反三", "觸類旁通", "腳踏實地",
  "按部就班", "全神貫注", "聚精會神", "專心致志", "孜孜不倦", "千錘百鍊",
  "百折不撓", "力爭上游", "奮發圖強", "自強不息", "飲水思源", "推陳出新",
  "與時俱進", "獨樹一幟", "別出心裁", "畫龍點睛", "錦上添花", "雪中送炭",
  "守望相助", "同舟共濟", "群策群力", "相輔相成", "相得益彰", "心照不宣",
  "言簡意賅", "開門見山", "一針見血", "切中要害", "深入淺出", "娓娓道來",
  "妙語如珠", "實至名歸", "名副其實", "不謀而合", "旗開得勝", "馬到成功",
];

const TECH_WORDS: string[] = [
  "人工智慧", "機器學習", "雲端運算", "資訊安全", "開源社群", "版本控制",
  "持續整合", "自動部署", "單元測試", "效能優化", "使用體驗", "資料庫",
  "伺服器", "瀏覽器", "演算法", "工程師", "架構師", "程式碼", "工作流程",
  "自動化", "模組化", "元件化", "相容性", "可讀性", "響應式", "非同步",
  "除錯", "重構", "同步", "離線", "快取", "憑證", "權限", "加密",
  "備援", "監控", "日誌", "指標", "排程", "簡報", "報表", "預算",
  "合約", "發票", "帳單", "銀行", "轉帳", "投資", "理財", "風險",
];

export const PHRASE_BANK: PhraseItem[] = [
  ...DAILY_WORDS.map((text): PhraseItem => ({ text, cat: "daily" })),
  ...IDIOM_WORDS.map((text): PhraseItem => ({ text, cat: "idiom" })),
  ...TECH_WORDS.map((text): PhraseItem => ({ text, cat: "tech" })),
];

export function filterPhrases(cat: PhraseCategory): PhraseItem[] {
  if (cat === "all") return PHRASE_BANK;
  return PHRASE_BANK.filter((p) => p.cat === cat);
}

/** Resolve every character of a phrase against liu-table.json; returns null if any char is missing. */
export function resolvePhrase(item: PhraseItem, table: Table): ResolvedPhrase | null {
  const chars: ResolvedChar[] = [];
  for (const c of Array.from(item.text)) {
    const e = lookup(table, c);
    if (!e || e.k.length === 0) return null;
    chars.push({ c, k: e.k, a: e.a });
  }
  if (chars.length === 0) return null;
  return { text: item.text, cat: item.cat, chars };
}

/** Filter and resolve a category's phrases against the code table. */
export function buildPhrasePool(cat: PhraseCategory, table: Table): ResolvedPhrase[] {
  const out: ResolvedPhrase[] = [];
  for (const item of filterPhrases(cat)) {
    const resolved = resolvePhrase(item, table);
    if (resolved) out.push(resolved);
  }
  return out;
}

/** Grade a single character code input inside a phrase (matches direct-commit or select codes). */
export function gradePhraseChar(
  ch: ResolvedChar,
  raw: string,
): { ok: boolean; usedSelect: boolean } {
  const code = raw.trim().toLowerCase();
  if (!code) return { ok: false, usedSelect: false };
  if (ch.k.includes(code)) return { ok: true, usedSelect: false };
  if (ch.a && ch.a.includes(code)) return { ok: true, usedSelect: true };
  return { ok: false, usedSelect: false };
}

export function phraseCategoryLabel(cat: PhraseCategory): string {
  return PHRASE_CATEGORIES.find((x) => x.v === cat)?.label ?? "詞彙";
}
