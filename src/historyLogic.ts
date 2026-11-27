// Pure helpers for daily practice history and backup (no React), so they can be unit-tested with plain node.

import { mergeWordbook, sanitizeWordbook } from "./wordbookLogic";

export const STATS_KEY = "boshiamy-practice-stats-v1";
export const HISTORY_KEY = "boshiamy-practice-history-v1";
export const AUTO_NEXT_KEY = "boshiamy-auto-next-v2";
export const DAILY_GOAL_KEY = "boshiamy-daily-goal-v1";
export const BESTS_KEY = "boshiamy-bests-v1";
export const SOUND_KEY = "boshiamy-sound-v1";
export const DAILY_GOAL_OPTIONS = [30, 50, 100, 200] as const;
export const DEFAULT_DAILY_GOAL = 50;
export const BACKUP_VERSION = 1;
export const MAX_HISTORY_DAYS = 400;
export const MAX_ITEM_MS = 5 * 60 * 1000;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_MAP_KEYS = 5000;
export const MAX_MAP_KEY_LEN = 16;
export const MAX_INT = 1_000_000_000;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type DrillMode = "roots" | "chars" | "short" | "phrases" | "timed" | "article";
export const DRILL_MODES: DrillMode[] = ["roots", "chars", "short", "phrases", "timed", "article"];
export const MODE_LABEL: Record<DrillMode, string> = {
  roots: "字根",
  chars: "常用字",
  short: "簡碼",
  phrases: "詞彙",
  timed: "限時",
  article: "文章",
};

export type ModeStats = {
  tried: number;
  ok: number;
  ms: number;
};

export type DayRecord = {
  date: string;
  roots?: ModeStats;
  chars?: ModeStats;
  short?: ModeStats;
  phrases?: ModeStats;
  timed?: ModeStats;
  article?: ModeStats;
};

export type HistoryStore = {
  days: Record<string, DayRecord>;
};

export type SavedStats = {
  ok: number;
  tried: number;
  streak: number;
  missChars: Record<string, number>;
  missRoots: Record<string, number>;
};

export type BackupSettings = {
  autoNext: boolean;
  theme?: string;
  colorMode?: string;
  dailyGoal?: number;
  sound?: boolean;
};

export type TimedRecord = {
  score: number;
  tried: number;
  diff: number;
  date: string;
};

export type ArticleBest = {
  cpm: number;
  accuracy: number;
  date: string;
};

export type PersonalBests = {
  timedBestByDiff: Record<string, TimedRecord>;
  timedRecent: TimedRecord[];
  articleBestCpm?: ArticleBest;
};

const VALID_THEMES = new Set(["ink", "studio", "playful", "minimal"]);
const VALID_COLOR_MODES = new Set(["system", "light", "dark"]);
const VALID_DIFFS = new Set(["100", "300", "600", "1000"]);

export function sanitizeDailyGoal(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const n = Math.floor(raw);
  if (n < 10 || n > 1000) return undefined;
  return n;
}

export function sanitizeSettings(raw: unknown): BackupSettings {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: BackupSettings = { autoNext: !!r.autoNext };
  if (typeof r.theme === "string" && VALID_THEMES.has(r.theme)) out.theme = r.theme;
  if (typeof r.colorMode === "string" && VALID_COLOR_MODES.has(r.colorMode)) out.colorMode = r.colorMode;
  const g = sanitizeDailyGoal(r.dailyGoal);
  if (g != null) out.dailyGoal = g;
  if (typeof r.sound === "boolean") out.sound = r.sound;
  return out;
}

export type BackupFile = {
  version: number;
  exportedAt: string;
  stats: SavedStats;
  history: HistoryStore;
  settings: BackupSettings;
  bests?: PersonalBests;
  wordbook?: string[];
};

export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function emptyMode(): ModeStats {
  return { tried: 0, ok: 0, ms: 0 };
}

export function emptyHistory(): HistoryStore {
  return { days: Object.create(null) as Record<string, DayRecord> };
}

export function emptyCountMap(): Record<string, number> {
  return Object.create(null) as Record<string, number>;
}

export function emptyStats(): SavedStats {
  return { ok: 0, tried: 0, streak: 0, missChars: emptyCountMap(), missRoots: emptyCountMap() };
}

export function oversizedBackupMessage(byteLength: number): string | null {
  if (typeof byteLength === "number" && Number.isFinite(byteLength) && byteLength > MAX_BACKUP_BYTES) {
    return "備份檔太大（上限 2 MB），請確認檔案是否正確。";
  }
  return null;
}

function isSafeMapKey(k: string): boolean {
  return k.length > 0 && k.length <= MAX_MAP_KEY_LEN && !DANGEROUS_KEYS.has(k);
}

export function addMode(a: ModeStats | undefined, b: ModeStats | undefined): ModeStats {
  const x = a ?? emptyMode();
  const y = b ?? emptyMode();
  return { tried: x.tried + y.tried, ok: x.ok + y.ok, ms: x.ms + y.ms };
}

function clampInt(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return fallback;
  return Math.min(MAX_INT, Math.floor(n));
}

export function sanitizeModeStats(raw: unknown): ModeStats | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<ModeStats>;
  const tried = clampInt(p.tried);
  const ok = Math.min(tried, clampInt(p.ok));
  const ms = clampInt(p.ms);
  return { tried, ok, ms };
}

export function sanitizeDay(date: string, raw: unknown): DayRecord | null {
  if (!isDateKey(date) || !raw || typeof raw !== "object") return null;
  const p = raw as Partial<DayRecord>;
  const day: DayRecord = { date };
  let any = false;
  for (const m of DRILL_MODES) {
    const s = sanitizeModeStats(p[m]);
    if (s && s.tried > 0) {
      day[m] = s;
      any = true;
    }
  }
  return any ? day : { date };
}

export function sanitizeHistory(raw: unknown): HistoryStore {
  const out = emptyHistory();
  if (!raw || typeof raw !== "object") return out;
  const days = (raw as { days?: unknown }).days;
  if (!days || typeof days !== "object" || Array.isArray(days)) return out;
  for (const [k, v] of Object.entries(days as Record<string, unknown>)) {
    const day = sanitizeDay(k, v);
    if (day && DRILL_MODES.some((m) => (day[m]?.tried ?? 0) > 0)) out.days[k] = day;
  }
  pruneHistory(out);
  return out;
}

export function countMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyCountMap();
  const out = emptyCountMap();
  let size = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSafeMapKey(k)) continue;
    const n = clampInt(v);
    if (n <= 0) continue;
    if (!(k in out) && size >= MAX_MAP_KEYS) continue;
    if (!(k in out)) size += 1;
    out[k] = n;
  }
  return out;
}

export function sanitizeStats(raw: unknown): SavedStats {
  if (!raw || typeof raw !== "object") return emptyStats();
  const p = raw as Partial<SavedStats>;
  return {
    ok: clampInt(p.ok),
    tried: clampInt(p.tried),
    streak: clampInt(p.streak),
    missChars: countMap(p.missChars),
    missRoots: countMap(p.missRoots),
  };
}

export function pruneHistory(store: HistoryStore, keep = MAX_HISTORY_DAYS): HistoryStore {
  const keys = Object.keys(store.days).sort();
  if (keys.length <= keep) return store;
  const drop = keys.slice(0, keys.length - keep);
  for (const k of drop) delete store.days[k];
  return store;
}

export function recordAttempt(
  history: HistoryStore,
  mode: DrillMode,
  inc: { tried?: number; ok?: number; ms?: number },
  date = localDate(),
): HistoryStore {
  if (!isDateKey(date) || !DRILL_MODES.includes(mode)) return history;
  const tried = clampInt(inc.tried ?? 1);
  const ok = Math.min(tried, clampInt(inc.ok ?? 0));
  const ms = Math.min(MAX_ITEM_MS * Math.max(tried, 1), clampInt(inc.ms ?? 0));
  if (tried <= 0 && ok <= 0 && ms <= 0) return history;
  const prevDay = history.days[date] ?? { date };
  const next: DayRecord = {
    ...prevDay,
    date,
    [mode]: addMode(prevDay[mode], { tried, ok, ms }),
  };
  const days = { ...history.days, [date]: next };
  return pruneHistory({ days });
}

export function dayTotals(day: DayRecord | undefined, mode: DrillMode | "all" = "all"): ModeStats {
  if (!day) return emptyMode();
  if (mode !== "all") return day[mode] ?? emptyMode();
  return DRILL_MODES.reduce((acc, m) => addMode(acc, day[m]), emptyMode());
}

export function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return localDate(dt);
}

export function dateRange(endDate: string, length: number): string[] {
  const n = Math.max(1, Math.floor(length));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endDate, -i));
  return out;
}

export function seriesFor(
  history: HistoryStore,
  endDate: string,
  length: number,
  mode: DrillMode | "all" = "all",
): { date: string; stats: ModeStats; accuracy: number | null; secPerItem: number | null; cpm: number | null }[] {
  return dateRange(endDate, length).map((date) => {
    const stats = dayTotals(history.days[date], mode);
    return {
      date,
      stats,
      accuracy: accuracyOf(stats),
      secPerItem: secPerItemOf(stats),
      cpm: cpmOf(stats),
    };
  });
}

export function rangeTotals(
  history: HistoryStore,
  endDate: string,
  length: number,
  mode: DrillMode | "all" = "all",
): ModeStats {
  return dateRange(endDate, length).reduce((acc, d) => addMode(acc, dayTotals(history.days[d], mode)), emptyMode());
}

export function accuracyOf(s: ModeStats): number | null {
  if (s.tried <= 0) return null;
  return s.ok / s.tried;
}

export function secPerItemOf(s: ModeStats): number | null {
  if (s.tried <= 0 || s.ms <= 0) return null;
  return s.ms / 1000 / s.tried;
}

export function cpmOf(s: ModeStats): number | null {
  if (s.ok <= 0 || s.ms <= 0) return null;
  return (s.ok / s.ms) * 60000;
}

export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return s + " 秒";
  return m + " 分 " + s + " 秒";
}

export function formatPct(s: ModeStats): string {
  const a = accuracyOf(s);
  if (a == null) return "—";
  return Math.round(a * 100) + "%";
}

export function formatSecPerItem(s: ModeStats): string {
  const v = secPerItemOf(s);
  if (v == null) return "—";
  return (Math.round(v * 10) / 10).toFixed(1) + " 秒/題";
}

export function formatCpm(s: ModeStats): string {
  const v = cpmOf(s);
  if (v == null) return "—";
  return Math.round(v) + " 字/分";
}

export function formatSpeed(s: ModeStats, mode: DrillMode | "all"): string {
  if (mode === "article") return formatCpm(s);
  if (mode === "all") {
    const sec = formatSecPerItem(s);
    const art = s.tried > 0 && s.ms > 0 ? formatCpm(s) : "—";
    if (sec === "—" && art === "—") return "—";
    if (art === "—") return sec;
    return sec + "（文章 " + art + "）";
  }
  return formatSecPerItem(s);
}

export function recentDays(history: HistoryStore, limit = 30): DayRecord[] {
  return Object.keys(history.days)
    .sort()
    .reverse()
    .slice(0, limit)
    .map((d) => history.days[d]);
}

export function mergeCountMaps(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = emptyCountMap();
  let size = 0;
  for (const src of [a, b]) {
    for (const [k, v] of Object.entries(src)) {
      if (!isSafeMapKey(k)) continue;
      const n = clampInt((out[k] ?? 0) + clampInt(v));
      if (n <= 0) continue;
      if (!(k in out) && size >= MAX_MAP_KEYS) continue;
      if (!(k in out)) size += 1;
      out[k] = n;
    }
  }
  return out;
}

export function mergeHistory(a: HistoryStore, b: HistoryStore): HistoryStore {
  const days: Record<string, DayRecord> = { ...a.days };
  for (const [date, day] of Object.entries(b.days)) {
    const prev = days[date];
    if (!prev) {
      days[date] = { ...day, date };
      continue;
    }
    const next: DayRecord = { date };
    for (const m of DRILL_MODES) {
      const s = addMode(prev[m], day[m]);
      if (s.tried > 0) next[m] = s;
    }
    days[date] = next;
  }
  return pruneHistory({ days });
}

export function mergeStats(a: SavedStats, b: SavedStats): SavedStats {
  return {
    ok: a.ok + b.ok,
    tried: a.tried + b.tried,
    streak: a.streak,
    missChars: mergeCountMaps(a.missChars, b.missChars),
    missRoots: mergeCountMaps(a.missRoots, b.missRoots),
  };
}

export function makeBackup(input: {
  stats: SavedStats;
  history: HistoryStore;
  settings: BackupSettings;
  bests?: PersonalBests;
  wordbook?: string[];
  exportedAt?: string;
}): BackupFile {
  const out: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    stats: sanitizeStats(input.stats),
    history: sanitizeHistory(input.history),
    settings: sanitizeSettings(input.settings),
  };
  if (input.bests) {
    const cleanBests = sanitizeBests(input.bests);
    if (
      Object.keys(cleanBests.timedBestByDiff).length > 0 ||
      cleanBests.timedRecent.length > 0 ||
      cleanBests.articleBestCpm != null
    ) {
      out.bests = cleanBests;
    }
  }
  if (input.wordbook) {
    const cleanWordbook = sanitizeWordbook(input.wordbook);
    if (cleanWordbook.length > 0) {
      out.wordbook = cleanWordbook;
    }
  }
  return out;
}

export function parseBackup(raw: string): { ok: true; data: BackupFile } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "這不是有效的 JSON 檔。" };
  }
  const tooBig = oversizedBackupMessage(raw.length);
  if (tooBig) return { ok: false, error: tooBig };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: "這不是有效的 JSON 檔。" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "備份檔格式不正確。" };
  }
  const p = parsed as Partial<BackupFile> & {
    history?: unknown;
    stats?: unknown;
    settings?: unknown;
    bests?: unknown;
    wordbook?: unknown;
  };
  if (typeof p.version !== "number" || p.version < 1 || p.version > BACKUP_VERSION) {
    return { ok: false, error: "這個備份檔版本無法匯入。" };
  }
  if (!p.stats || typeof p.stats !== "object") {
    return { ok: false, error: "備份檔缺少練習紀錄。" };
  }
  const data = makeBackup({
    stats: sanitizeStats(p.stats),
    history: sanitizeHistory(p.history ?? emptyHistory()),
    settings: sanitizeSettings(p.settings),
    bests: p.bests !== undefined ? sanitizeBests(p.bests) : undefined,
    wordbook: p.wordbook !== undefined ? sanitizeWordbook(p.wordbook) : undefined,
    exportedAt: typeof p.exportedAt === "string" ? p.exportedAt : new Date().toISOString(),
  });
  return { ok: true, data };
}

export type ImportMode = "merge" | "replace";

export function applyBackup(
  current: {
    stats: SavedStats;
    history: HistoryStore;
    settings: BackupSettings;
    bests?: PersonalBests;
    wordbook?: string[];
  },
  incoming: BackupFile,
  mode: ImportMode,
): {
  stats: SavedStats;
  history: HistoryStore;
  settings: BackupSettings;
  bests: PersonalBests;
  wordbook: string[];
} {
  const curBests = sanitizeBests(current.bests);
  const incBests = sanitizeBests(incoming.bests);
  const curWordbook = sanitizeWordbook(current.wordbook);
  const incWordbook = sanitizeWordbook(incoming.wordbook);
  if (mode === "replace") {
    return {
      stats: sanitizeStats(incoming.stats),
      history: sanitizeHistory(incoming.history),
      settings: sanitizeSettings(incoming.settings),
      bests: incBests,
      wordbook: incWordbook,
    };
  }
  return {
    stats: mergeStats(current.stats, incoming.stats),
    history: mergeHistory(current.history, incoming.history),
    settings: current.settings,
    bests: mergeBests(curBests, incBests),
    wordbook: mergeWordbook(curWordbook, incWordbook),
  };
}

export function backupToJson(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(date = localDate()): string {
  return "boshiamy-backup-" + date + ".json";
}

export function loadHistoryFromStorage(getItem: (k: string) => string | null): HistoryStore {
  try {
    const raw = getItem(HISTORY_KEY);
    if (!raw) return emptyHistory();
    return sanitizeHistory(JSON.parse(raw) as unknown);
  } catch {
    return emptyHistory();
  }
}

export function saveHistoryToStorage(setItem: (k: string, v: string) => void, history: HistoryStore): void {
  setItem(HISTORY_KEY, JSON.stringify(pruneHistory(sanitizeHistory(history))));
}

/** Trigger a JSON file download. Works in a user-gesture click on Safari / installed PWA. */
export function downloadJsonFile(filename: string, text: string, doc: Document = document): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function canShareBackupFiles(): boolean {
  try {
    const file = new File(["{}"], "boshiamy-backup.json", { type: "application/json" });
    return typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

export async function shareBackupFile(filename: string, text: string): Promise<boolean> {
  try {
    const file = new File([text], filename, { type: "application/json" });
    if (!navigator.share) return false;
    await navigator.share({ files: [file], title: "嘸蝦米練功紀錄" });
    return true;
  } catch (e) {
    if (e && typeof e === "object" && (e as { name?: string }).name === "AbortError") return false;
    return false;
  }
}

export function clipMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(MAX_ITEM_MS, Math.round(ms));
}

export function practiceStreakDays(history: HistoryStore, today = localDate()): number {
  if (!isDateKey(today)) return 0;
  const todayStats = dayTotals(history.days[today], "all");
  let cur = todayStats.tried > 0 ? today : addDays(today, -1);
  let days = 0;
  for (let i = 0; i < MAX_HISTORY_DAYS; i++) {
    if (dayTotals(history.days[cur], "all").tried <= 0) break;
    days += 1;
    cur = addDays(cur, -1);
  }
  return days;
}

export type TodaySummary = {
  tried: number;
  ok: number;
  ms: number;
  goal: number;
  pct: number;
  done: boolean;
};

export function todaySummary(
  history: HistoryStore,
  today = localDate(),
  goal = DEFAULT_DAILY_GOAL,
): TodaySummary {
  const safeGoal = Math.max(1, Math.floor(Number.isFinite(goal) ? goal : DEFAULT_DAILY_GOAL));
  const stats = isDateKey(today) ? dayTotals(history.days[today], "all") : emptyMode();
  return {
    tried: stats.tried,
    ok: stats.ok,
    ms: stats.ms,
    goal: safeGoal,
    pct: Math.min(100, Math.round((stats.tried / safeGoal) * 100)),
    done: stats.tried >= safeGoal,
  };
}

// ---- Personal bests (timed challenge & article CPM) ----

export const MAX_TIMED_RECENT = 5;

export function emptyBests(): PersonalBests {
  return {
    timedBestByDiff: Object.create(null) as Record<string, TimedRecord>,
    timedRecent: [],
  };
}

function sanitizeTimedRecord(raw: unknown): TimedRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Partial<TimedRecord>;
  if (typeof r.date !== "string" || !isDateKey(r.date)) return null;
  const diffNum = typeof r.diff === "number" && Number.isFinite(r.diff) ? Math.floor(r.diff) : 0;
  if (!VALID_DIFFS.has(String(diffNum))) return null;
  const tried = clampInt(r.tried);
  const score = Math.min(tried, clampInt(r.score));
  return { score, tried, diff: diffNum, date: r.date };
}

function sanitizeArticleBest(raw: unknown): ArticleBest | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Partial<ArticleBest>;
  if (typeof r.date !== "string" || !isDateKey(r.date)) return undefined;
  const cpm = clampInt(r.cpm);
  if (cpm <= 0) return undefined;
  const accRaw = typeof r.accuracy === "number" && Number.isFinite(r.accuracy) ? r.accuracy : 0;
  const accuracy = Math.max(0, Math.min(100, Math.round(accRaw)));
  return { cpm, accuracy, date: r.date };
}

function isBetterTimed(a: TimedRecord, b: TimedRecord): boolean {
  if (a.score !== b.score) return a.score > b.score;
  const accA = a.tried > 0 ? a.score / a.tried : 0;
  const accB = b.tried > 0 ? b.score / b.tried : 0;
  return accA > accB;
}

export function sanitizeBests(raw: unknown): PersonalBests {
  const out = emptyBests();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Partial<PersonalBests>;
  if (r.timedBestByDiff && typeof r.timedBestByDiff === "object" && !Array.isArray(r.timedBestByDiff)) {
    for (const [k, v] of Object.entries(r.timedBestByDiff as Record<string, unknown>)) {
      if (!isSafeMapKey(k) || !VALID_DIFFS.has(k)) continue;
      const rec = sanitizeTimedRecord(v);
      if (rec && String(rec.diff) === k) out.timedBestByDiff[k] = rec;
    }
  }
  if (Array.isArray(r.timedRecent)) {
    for (const item of r.timedRecent) {
      const rec = sanitizeTimedRecord(item);
      if (rec) out.timedRecent.push(rec);
      if (out.timedRecent.length >= MAX_TIMED_RECENT) break;
    }
  }
  const art = sanitizeArticleBest(r.articleBestCpm);
  if (art) out.articleBestCpm = art;
  return out;
}

export function mergeBests(a: PersonalBests, b: PersonalBests): PersonalBests {
  const cleanA = sanitizeBests(a);
  const cleanB = sanitizeBests(b);
  const timedBestByDiff = Object.create(null) as Record<string, TimedRecord>;
  for (const src of [cleanA.timedBestByDiff, cleanB.timedBestByDiff]) {
    for (const [k, rec] of Object.entries(src)) {
      const prev = timedBestByDiff[k];
      if (!prev || isBetterTimed(rec, prev)) timedBestByDiff[k] = rec;
    }
  }
  const seen = new Set<string>();
  const timedRecent: TimedRecord[] = [];
  for (const rec of [...cleanA.timedRecent, ...cleanB.timedRecent]) {
    const sig = `${rec.date}|${rec.diff}|${rec.score}|${rec.tried}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    timedRecent.push(rec);
    if (timedRecent.length >= MAX_TIMED_RECENT) break;
  }
  let articleBestCpm = cleanA.articleBestCpm;
  if (cleanB.articleBestCpm && (!articleBestCpm || cleanB.articleBestCpm.cpm > articleBestCpm.cpm)) {
    articleBestCpm = cleanB.articleBestCpm;
  }
  return articleBestCpm
    ? { timedBestByDiff, timedRecent, articleBestCpm }
    : { timedBestByDiff, timedRecent };
}

export function recordTimedRun(
  bests: PersonalBests,
  run: { score: number; tried: number; diff: number; date?: string },
): { bests: PersonalBests; isNewBest: boolean; prevBest: TimedRecord | null } {
  const clean = sanitizeBests(bests);
  const date = run.date && isDateKey(run.date) ? run.date : localDate();
  const diffNum = Math.floor(run.diff);
  const key = String(diffNum);
  const tried = clampInt(run.tried);
  const score = Math.min(tried, clampInt(run.score));
  const rec: TimedRecord = { score, tried, diff: diffNum, date };
  const prevBest = clean.timedBestByDiff[key] ?? null;
  const isNewBest = score > 0 && (!prevBest || isBetterTimed(rec, prevBest));
  const nextByDiff: Record<string, TimedRecord> = Object.assign(
    Object.create(null) as Record<string, TimedRecord>,
    clean.timedBestByDiff,
  );
  if (VALID_DIFFS.has(key) && isNewBest) nextByDiff[key] = rec;
  const nextRecent = VALID_DIFFS.has(key)
    ? [rec, ...clean.timedRecent].slice(0, MAX_TIMED_RECENT)
    : clean.timedRecent;
  const next: PersonalBests = clean.articleBestCpm
    ? { timedBestByDiff: nextByDiff, timedRecent: nextRecent, articleBestCpm: clean.articleBestCpm }
    : { timedBestByDiff: nextByDiff, timedRecent: nextRecent };
  return { bests: next, isNewBest, prevBest };
}

export function recordArticleRun(
  bests: PersonalBests,
  run: { cpm: number; accuracy: number; date?: string },
): { bests: PersonalBests; isNewBest: boolean; prevBest: ArticleBest | null } {
  const clean = sanitizeBests(bests);
  const prevBest = clean.articleBestCpm ?? null;
  const cpm = clampInt(run.cpm);
  const accuracy = Math.max(0, Math.min(100, Math.round(Number.isFinite(run.accuracy) ? run.accuracy : 0)));
  const date = run.date && isDateKey(run.date) ? run.date : localDate();
  if (cpm <= 0) return { bests: clean, isNewBest: false, prevBest };
  const isNewBest = !prevBest || cpm > prevBest.cpm;
  if (!isNewBest) return { bests: clean, isNewBest: false, prevBest };
  const next: PersonalBests = {
    timedBestByDiff: clean.timedBestByDiff,
    timedRecent: clean.timedRecent,
    articleBestCpm: { cpm, accuracy, date },
  };
  return { bests: next, isNewBest: true, prevBest };
}

export function loadBestsFromStorage(getItem: (k: string) => string | null): PersonalBests {
  try {
    const raw = getItem(BESTS_KEY);
    if (!raw) return emptyBests();
    return sanitizeBests(JSON.parse(raw) as unknown);
  } catch {
    return emptyBests();
  }
}

export function saveBestsToStorage(setItem: (k: string, v: string) => void, bests: PersonalBests): void {
  setItem(BESTS_KEY, JSON.stringify(sanitizeBests(bests)));
}

// ---- History heatmap, weak items ranking, and period delta ----

export type HeatmapCell = {
  date: string;
  tried: number;
  ok: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
};

export function heatmapLevel(tried: number): 0 | 1 | 2 | 3 | 4 {
  if (tried <= 0) return 0;
  if (tried < 20) return 1;
  if (tried < 50) return 2;
  if (tried < 100) return 3;
  return 4;
}

/** Build `weeks` columns (Sun..Sat, 7 rows each) ending on the week containing `endDate`. */
export function heatmapWeeks(history: HistoryStore, endDate = localDate(), weeks = 12): HeatmapCell[][] {
  if (!isDateKey(endDate) || weeks <= 0) return [];
  const [y, m, d] = endDate.split("-").map(Number);
  const endDt = new Date(y, m - 1, d);
  const dow = endDt.getDay(); // 0 = Sun .. 6 = Sat
  const endWeekSun = addDays(endDate, -dow);
  const startSun = addDays(endWeekSun, -(weeks - 1) * 7);
  const cols: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatmapCell[] = [];
    for (let r = 0; r < 7; r++) {
      const date = addDays(startSun, w * 7 + r);
      const future = date > endDate;
      const stats = future ? emptyMode() : dayTotals(history.days[date], "all");
      col.push({
        date,
        tried: stats.tried,
        ok: stats.ok,
        level: future ? 0 : heatmapLevel(stats.tried),
        future,
      });
    }
    cols.push(col);
  }
  return cols;
}

export type WeakRankItem = {
  kind: "char" | "root";
  key: string;
  glyph: string;
  sub?: string;
  count: number;
};

export function topWeakItems(
  missChars: Record<string, number>,
  missRoots: Record<string, number>,
  limit = 20,
): WeakRankItem[] {
  const items: WeakRankItem[] = [];
  for (const [k, v] of Object.entries(missChars)) {
    if (typeof v !== "number" || v <= 0) continue;
    items.push({ kind: "char", key: "char:" + k, glyph: k, count: v });
  }
  for (const [k, v] of Object.entries(missRoots)) {
    if (typeof v !== "number" || v <= 0) continue;
    const colon = k.indexOf(":");
    const keyLetter = colon > 0 ? k.slice(0, colon).toUpperCase() : "";
    const glyph = colon >= 0 ? k.slice(colon + 1) : k;
    items.push({
      kind: "root",
      key: "root:" + k,
      glyph: glyph || k,
      sub: keyLetter || undefined,
      count: v,
    });
  }
  items.sort((a, b) => (b.count !== a.count ? b.count - a.count : a.key.localeCompare(b.key)));
  return items.slice(0, Math.max(0, limit));
}

export function periodDelta(
  history: HistoryStore,
  endDate: string,
  length: number,
  mode: DrillMode | "all" = "all",
): { triedDiff: number | null; accDiffPct: number | null } {
  if (!isDateKey(endDate) || length <= 0) return { triedDiff: null, accDiffPct: null };
  const cur = rangeTotals(history, endDate, length, mode);
  const prevEnd = addDays(endDate, -length);
  const prev = rangeTotals(history, prevEnd, length, mode);
  if (prev.tried <= 0) return { triedDiff: null, accDiffPct: null };
  const triedDiff = cur.tried - prev.tried;
  const curAcc = accuracyOf(cur);
  const prevAcc = accuracyOf(prev);
  const accDiffPct =
    curAcc != null && prevAcc != null ? Math.round((curAcc - prevAcc) * 100) : null;
  return { triedDiff, accDiffPct };
}
