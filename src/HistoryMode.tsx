import { useId, useMemo, useRef, useState, type ChangeEvent, type JSX, type ReactNode } from "react";
import type { GrokTheme } from "./theme";
import { IconGearButton, MobileShell } from "./MobileChrome";
import { BrandMark } from "./ThemePicker";
import {
  type BackupFile,
  type BackupSettings,
  type DrillMode,
  type HeatmapCell,
  type HistoryStore,
  type ImportMode,
  type PersonalBests,
  type SavedStats,
  DRILL_MODES,
  MODE_LABEL,
  backupFilename,
  backupToJson,
  canShareBackupFiles,
  downloadJsonFile,
  formatCpm,
  formatDuration,
  formatPct,
  formatSecPerItem,
  formatSpeed,
  heatmapWeeks,
  localDate,
  makeBackup,
  oversizedBackupMessage,
  parseBackup,
  periodDelta,
  recentDays,
  rangeTotals,
  seriesFor,
  shareBackupFile,
  topWeakItems,
  dayTotals,
} from "./historyLogic";

type RangeLen = 7 | 30;
type Filter = DrillMode | "all";

const FILTERS: { v: Filter; label: string }[] = [
  { v: "all", label: "全部" },
  { v: "roots", label: "字根" },
  { v: "chars", label: "常用字" },
  { v: "short", label: "簡碼" },
  { v: "phrases", label: "詞彙" },
  { v: "timed", label: "限時" },
  { v: "article", label: "文章" },
];

export default function HistoryMode(props: {
  theme: GrokTheme;
  isMobile: boolean;
  history: HistoryStore;
  stats: SavedStats;
  settings: BackupSettings;
  bests?: PersonalBests;
  wordbook?: string[];
  onStartWeakReview?: () => void;
  onOpenSettings: () => void;
  onImport: (data: BackupFile, mode: ImportMode) => void;
  mobileModeStrip?: ReactNode;
  mobileTodayBar?: ReactNode;
  mobileSheets?: ReactNode;
}): JSX.Element {
  const { theme, isMobile, history } = props;
  const [range, setRange] = useState<RangeLen>(7);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<HeatmapCell | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const today = localDate();

  const rows = useMemo(() => seriesFor(history, today, range, filter), [history, today, range, filter]);
  const totals = useMemo(() => rangeTotals(history, today, range, filter), [history, today, range, filter]);
  const delta = useMemo(() => periodDelta(history, today, range, filter), [history, today, range, filter]);
  const heatCols = useMemo(() => heatmapWeeks(history, today, 12), [history, today]);
  const weakRank = useMemo(
    () => topWeakItems(props.stats.missChars, props.stats.missRoots, 20),
    [props.stats.missChars, props.stats.missRoots],
  );
  const tableDays = useMemo(() => recentDays(history, 30), [history]);
  const canShare = useMemo(() => canShareBackupFiles(), []);

  const backup = (): BackupFile =>
    makeBackup({
      stats: props.stats,
      history: props.history,
      settings: props.settings,
      bests: props.bests,
      wordbook: props.wordbook,
    });

  function doExport(): void {
    setErr("");
    const data = backup();
    downloadJsonFile(backupFilename(today), backupToJson(data));
    setMsg("已匯出備份檔。若瀏覽器沒有直接下載，請改按「分享備份」。");
  }

  async function doShare(): Promise<void> {
    setErr("");
    const data = backup();
    const ok = await shareBackupFile(backupFilename(today), backupToJson(data));
    setMsg(ok ? "已打開分享選單。" : "分享已取消，或這個裝置不支援分享檔案。請改用「匯出備份」。");
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setMsg("");
    const tooBig = oversizedBackupMessage(file.size);
    if (tooBig) {
      setPending(null);
      setErr(tooBig);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        setPending(null);
        setErr(parsed.error);
        return;
      }
      setPending(parsed.data);
    };
    reader.onerror = () => setErr("讀取檔案失敗，請再試一次。");
    reader.readAsText(file);
  }

  function confirmImport(mode: ImportMode): void {
    if (!pending) return;
    props.onImport(pending, mode);
    setPending(null);
    setErr("");
    setMsg(mode === "merge" ? "已合併到現有紀錄。" : "已用備份檔覆蓋現有紀錄。");
  }

  const actionBtn = (label: string, onClick: () => void, testId: string, primary?: boolean): JSX.Element => (
    <button
      type="button"
      data-testid={testId}
      className={"ui-btn" + (primary ? " ui-btn-primary" : "")}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="application/json,.json"
      data-testid="history-import-input"
      className="visually-hidden"
      aria-label="選擇備份檔"
      onChange={onPickFile}
    />
  );

  const importPanel = pending ? (
    <div
      className="history-import-panel"
      data-testid="history-import-panel"
      role="dialog"
      aria-label="選擇匯入方式"
      style={{
        border: "1px solid " + theme.border.default,
        background: theme.fill.secondary,
        color: theme.text.primary,
      }}
    >
      <p style={{ ...theme.font.body1, margin: 0 }}>
        讀到一份備份（累計 {pending.stats.ok} / {pending.stats.tried} 題）。要合併到現有紀錄，還是整份覆蓋？
      </p>
      <div className="history-actions">
        {actionBtn("合併", () => confirmImport("merge"), "history-import-merge", true)}
        {actionBtn("覆蓋", () => confirmImport("replace"), "history-import-replace")}
        {actionBtn("取消", () => setPending(null), "history-import-cancel")}
      </div>
    </div>
  ) : null;

  const summary = (
    <div className="history-summary" data-testid="history-summary">
      {[
        {
          label: "題數",
          value: String(totals.tried),
          delta:
            delta.triedDiff != null
              ? {
                  text: "比前 " + range + " 天 " + (delta.triedDiff >= 0 ? "+" : "") + delta.triedDiff,
                  kind: delta.triedDiff > 0 ? "up" : delta.triedDiff < 0 ? "down" : "flat",
                }
              : null,
        },
        {
          label: "正確率",
          value: formatPct(totals),
          delta:
            delta.accDiffPct != null
              ? {
                  text:
                    delta.accDiffPct > 0
                      ? "↑" + delta.accDiffPct + "%"
                      : delta.accDiffPct < 0
                        ? "↓" + Math.abs(delta.accDiffPct) + "%"
                        : "持平",
                  kind: delta.accDiffPct > 0 ? "up" : delta.accDiffPct < 0 ? "down" : "flat",
                }
              : null,
        },
        { label: "練習時間", value: totals.ms > 0 ? formatDuration(totals.ms) : "—", delta: null },
        {
          label: filter === "article" ? "速度" : "平均速度",
          value: formatSpeed(totals, filter),
          delta: null,
        },
      ].map((s) => (
        <div key={s.label} className="history-stat">
          <div style={{ ...theme.font.caption, color: theme.text.tertiary }}>{s.label}</div>
          <div style={{ ...theme.font.heading3, fontWeight: theme.weight.semibold, marginTop: 2, overflowWrap: "anywhere" }}>
            {s.value}
          </div>
          {s.delta ? (
            <div className={"history-delta is-" + s.delta.kind} data-testid={"history-delta-" + s.label}>
              {s.delta.text}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );

  const bestTimedList = useMemo(() => {
    if (!props.bests) return [];
    return Object.entries(props.bests.timedBestByDiff)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, rec]) => rec);
  }, [props.bests]);

  const bestsStrip =
    bestTimedList.length > 0 || props.bests?.articleBestCpm ? (
      <div className="history-bests-strip" data-testid="history-bests">
        <span className="history-bests-label">🏆 個人最佳</span>
        {bestTimedList.map((rec) => (
          <span key={rec.diff} className="history-best-pill">
            限時前 {rec.diff} 字：{rec.score} 字/分
          </span>
        ))}
        {props.bests?.articleBestCpm ? (
          <span className="history-best-pill">
            文章最快：{props.bests.articleBestCpm.cpm} 字/分（{props.bests.articleBestCpm.accuracy}%）
          </span>
        ) : null}
      </div>
    ) : null;

  const heatmapBlock = (
    <div className="history-heatmap-card" data-testid="history-heatmap">
      <div className="history-heatmap-head">
        <span style={{ ...theme.font.caption, color: theme.text.secondary, fontWeight: theme.weight.semibold }}>
          近 12 週練習日曆
        </span>
        <div className="history-heatmap-legend" aria-hidden="true">
          <span>少</span>
          {([0, 1, 2, 3, 4] as const).map((lv) => (
            <span key={lv} className={"hm-cell is-lv" + lv} />
          ))}
          <span>多</span>
        </div>
      </div>
      <div className="hm-scroll">
        <div className="hm-wrap">
          <div className="hm-months">
            {heatCols.map((col, idx) => {
              const firstVisible = col.find((c) => !c.future) ?? col[0];
              const m = Number(firstVisible.date.slice(5, 7));
              const prevCol = idx > 0 ? heatCols[idx - 1] : null;
              const prevFirst = prevCol ? prevCol.find((c) => !c.future) ?? prevCol[0] : null;
              const prevM = prevFirst ? Number(prevFirst.date.slice(5, 7)) : -1;
              return (
                <span key={col[0].date} className="hm-month-label">
                  {idx === 0 || m !== prevM ? m + "月" : ""}
                </span>
              );
            })}
          </div>
          <div className="hm-body">
            <div className="hm-dow" aria-hidden="true">
              <span />
              <span>一</span>
              <span />
              <span>三</span>
              <span />
              <span>五</span>
              <span />
            </div>
            <div className="hm-grid" role="grid" aria-label="近 12 週練習日曆">
              {heatCols.map((col) => (
                <div key={col[0].date} className="hm-col">
                  {col.map((cell) => {
                    if (cell.future) {
                      return <span key={cell.date} className="hm-cell is-future" aria-hidden="true" />;
                    }
                    const isSel = selectedDay?.date === cell.date;
                    const acc = cell.tried > 0 ? Math.round((cell.ok / cell.tried) * 100) + "%" : "—";
                    const tip = cell.date + "：" + cell.tried + " 題" + (cell.tried > 0 ? "（正確率 " + acc + "）" : "");
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        data-date={cell.date}
                        data-level={cell.level}
                        title={tip}
                        aria-label={tip}
                        aria-pressed={isSel}
                        className={"hm-cell is-lv" + cell.level + (isSel ? " is-selected" : "")}
                        onClick={() => setSelectedDay((prev) => (prev?.date === cell.date ? null : cell))}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="history-heatmap-foot" data-testid="history-heatmap-detail">
        {selectedDay
          ? selectedDay.date +
            "：" +
            selectedDay.tried +
            " 題" +
            (selectedDay.tried > 0
              ? " · 答對 " + selectedDay.ok + "（" + Math.round((selectedDay.ok / selectedDay.tried) * 100) + "%）"
              : "（當天沒有練習）")
          : "點選任一格可查看當天練習題數與正確率"}
      </div>
    </div>
  );

  const maxWeak = weakRank.length > 0 ? weakRank[0].count : 1;
  const weakRankBlock = (
    <div className="history-weak-card" data-testid="history-weak-rank">
      <div className="history-weak-head">
        <h3 style={{ ...theme.font.heading3, margin: 0, fontWeight: theme.weight.semibold }}>
          弱點字／字根排行{weakRank.length > 0 ? " Top " + weakRank.length : ""}
        </h3>
        {weakRank.length > 0 && props.onStartWeakReview ? (
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            data-testid="history-weak-cta"
            style={{ minHeight: 34, padding: "4px 12px", fontSize: 13 }}
            onClick={props.onStartWeakReview}
          >
            去複習弱點 →
          </button>
        ) : null}
      </div>
      {weakRank.length === 0 ? (
        <p style={{ ...theme.font.caption, color: theme.text.tertiary, margin: "6px 0 0" }}>
          目前沒有累積錯字，繼續保持！
        </p>
      ) : (
        <div className="history-weak-grid">
          {weakRank.map((item, idx) => (
            <div key={item.key} className="history-weak-item" data-rank={idx + 1}>
              <div className="history-weak-top">
                <span className="history-weak-glyph">{item.glyph}</span>
                {item.sub ? <span className="history-weak-sub">{item.sub}</span> : null}
                <span className="history-weak-count">×{item.count}</span>
              </div>
              <div className="history-weak-bar-track" aria-hidden="true">
                <div
                  className="history-weak-bar-fill"
                  style={{ width: Math.max(12, Math.round((item.count / maxWeak) * 100)) + "%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const controls = (
    <>
      <div className="history-seg" role="group" aria-label="檢視天數">
        {([7, 30] as RangeLen[]).map((n) => (
          <button
            key={n}
            type="button"
            data-testid={"history-range-" + n}
            aria-pressed={range === n}
            className={"ui-pill" + (range === n ? " is-on" : "")}
            onClick={() => setRange(n)}
          >
            近 {n} 天
          </button>
        ))}
      </div>
      <div className="history-seg" role="group" aria-label="練習模式">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            type="button"
            data-testid={"history-filter-" + f.v}
            aria-pressed={filter === f.v}
            className={"ui-pill" + (filter === f.v ? " is-on" : "")}
            onClick={() => setFilter(f.v)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </>
  );

  const volumeVals = rows.map((r) => r.stats.tried);
  const accVals = rows.map((r) => r.accuracy);
  const speedVals =
    filter === "article" ? rows.map((r) => r.cpm) : rows.map((r) => r.secPerItem);
  const speedUnit = filter === "article" ? "字/分" : "秒/題";

  const charts = (
    <div className="history-charts">
      <LineOrBarChart
        theme={theme}
        title={"題數（近 " + range + " 天）"}
        testId="history-chart-volume"
        labels={rows.map((r) => r.date)}
        values={volumeVals.map((v) => v)}
        kind="bar"
        formatTick={(v) => String(Math.round(v))}
        formatValue={(v) => String(Math.round(v)) + " 題"}
      />
      <LineOrBarChart
        theme={theme}
        title={"正確率（近 " + range + " 天）"}
        testId="history-chart-accuracy"
        labels={rows.map((r) => r.date)}
        values={accVals}
        kind="line"
        yMin={0}
        yMax={1}
        formatTick={(v) => Math.round(v * 100) + "%"}
        formatValue={(v) => Math.round(v * 100) + "%"}
      />
      <LineOrBarChart
        theme={theme}
        title={"速度（" + speedUnit + "，近 " + range + " 天）"}
        testId="history-chart-speed"
        labels={rows.map((r) => r.date)}
        values={speedVals}
        kind="line"
        formatTick={(v) => (v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1))}
        formatValue={(v) =>
          filter === "article" ? Math.round(v) + " 字/分" : (Math.round(v * 10) / 10).toFixed(1) + " 秒/題"
        }
      />
    </div>
  );

  const table = (
    <div className="history-table-wrap">
      <h3 style={{ ...theme.font.heading3, margin: "0 0 8px", fontWeight: theme.weight.semibold }}>最近練習日</h3>
      {tableDays.length === 0 ? (
        <p style={{ ...theme.font.body1, color: theme.text.secondary, margin: 0 }} data-testid="history-empty">
          還沒有每天的練習歷程。練幾題之後，這裡就會出現圖表。
        </p>
      ) : (
        <div className="history-table-scroll">
          <table className="history-table" data-testid="history-table">
            <thead>
              <tr>
                <th style={{ color: theme.text.tertiary, borderColor: theme.border.subtle }}>日期</th>
                <th style={{ color: theme.text.tertiary, borderColor: theme.border.subtle }}>模式</th>
                <th style={{ color: theme.text.tertiary, borderColor: theme.border.subtle }}>題數</th>
                <th style={{ color: theme.text.tertiary, borderColor: theme.border.subtle }}>正確率</th>
                <th style={{ color: theme.text.tertiary, borderColor: theme.border.subtle }}>用時</th>
                <th style={{ color: theme.text.tertiary, borderColor: theme.border.subtle }}>速度</th>
              </tr>
            </thead>
            <tbody>
              {tableDays.map((day) => {
                const all = dayTotals(day, "all");
                const parts = DRILL_MODES.filter((m) => (day[m]?.tried ?? 0) > 0)
                  .map((m) => MODE_LABEL[m] + " " + day[m]!.tried)
                  .join("、");
                return (
                  <tr key={day.date} data-date={day.date}>
                    <td style={{ borderColor: theme.border.subtle }}>{day.date.slice(5)}</td>
                    <td style={{ borderColor: theme.border.subtle }}>{parts || "—"}</td>
                    <td style={{ borderColor: theme.border.subtle }}>{all.ok} / {all.tried}</td>
                    <td style={{ borderColor: theme.border.subtle }}>{formatPct(all)}</td>
                    <td style={{ borderColor: theme.border.subtle }}>{all.ms > 0 ? formatDuration(all.ms) : "—"}</td>
                    <td style={{ borderColor: theme.border.subtle }}>
                      {formatSecPerItem(all)}
                      {day.article && day.article.tried > 0 ? "／" + formatCpm(day.article) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const backupBlock = (
    <div className="history-backup">
      <h3 style={{ ...theme.font.heading3, margin: "0 0 8px", fontWeight: theme.weight.semibold }}>備份</h3>
      <p style={{ ...theme.font.caption, color: theme.text.secondary, margin: "0 0 10px" }}>
        練習紀錄只存在這個裝置的瀏覽器。換手機或電腦前，先匯出備份檔，再到另一台匯入。iPhone 若沒直接下載，可用「分享備份」存到檔案或傳到另一台。
      </p>
      {fileInput}
      <div className="history-actions">
        {actionBtn("匯出備份", doExport, "history-export", true)}
        {canShare ? actionBtn("分享備份", () => void doShare(), "history-share") : null}
        {actionBtn("匯入備份", () => fileRef.current?.click(), "history-import")}
      </div>
      {importPanel}
      {msg ? (
        <p data-testid="history-msg" style={{ ...theme.font.caption, color: theme.text.success, margin: "8px 0 0" }}>
          {msg}
        </p>
      ) : null}
      {err ? (
        <p data-testid="history-err" style={{ ...theme.font.caption, color: theme.text.danger, margin: "8px 0 0" }}>
          {err}
        </p>
      ) : null}
    </div>
  );

  const body = (
    <div className="history-wrap" data-testid="history-root">
      {controls}
      {bestsStrip}
      {summary}
      {heatmapBlock}
      {charts}
      {weakRankBlock}
      {table}
      {backupBlock}
    </div>
  );

  if (isMobile) {
    const header = (
      <header className="mobile-header">
        <div className="mobile-header-text">
          <div className="mobile-brand-row">
            <BrandMark size={26} />
            <h1 style={{ fontWeight: theme.weight.semibold }}>無蝦米練功房</h1>
          </div>
          <div className="mobile-header-stats">
            紀錄 · 近 {range} 天 {formatPct(totals)}
          </div>
        </div>
        <IconGearButton theme={theme} onClick={props.onOpenSettings} />
      </header>
    );
    const footer = (
      <div className="os-actions">
        <button type="button" className="os-action" onClick={() => fileRef.current?.click()} style={{ minHeight: 52 }}>
          匯入備份
        </button>
        <button type="button" className="os-action is-primary" onClick={doExport} style={{ minHeight: 52 }}>
          匯出備份
        </button>
      </div>
    );
    return (
      <MobileShell
        theme={theme}
        header={header}
        modeStrip={props.mobileModeStrip}
        todayBar={props.mobileTodayBar}
        stage={body}
        footer={footer}
        sheets={props.mobileSheets}
      />
    );
  }

  return (
    <section
      data-testid="history-desktop"
      className="stage-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div className="stage-meta" style={{ alignSelf: "flex-start" }}>練習紀錄與進步趨勢</div>
      {body}
    </section>
  );
}

function LineOrBarChart(props: {
  theme: GrokTheme;
  title: string;
  testId: string;
  labels: string[];
  values: (number | null)[];
  kind: "bar" | "line";
  yMin?: number;
  yMax?: number;
  formatTick: (v: number) => string;
  formatValue: (v: number) => string;
}): JSX.Element {
  const { theme } = props;
  const uid = useId().replace(/:/g, "");
  const w = 380;
  const h = 148;
  const padL = 42;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const numeric = props.values.filter((v): v is number => v != null && Number.isFinite(v));
  const dataMax = numeric.length ? Math.max(...numeric) : 0;
  const dataMin = numeric.length ? Math.min(...numeric, 0) : 0;
  const yMin = props.yMin != null ? props.yMin : Math.min(0, dataMin);
  const rawMax = props.yMax != null ? props.yMax : dataMax;
  const yMax = rawMax > yMin ? rawMax : yMin + 1;
  const n = props.labels.length;
  const barW = n > 0 ? Math.max(3, Math.min(18, (innerW / Math.max(n, 1)) * 0.56)) : 8;
  const plotInset = props.kind === "bar" ? Math.max(12, barW / 2 + 6) : 10;
  const xAt = (i: number): number => {
    if (n <= 1) return padL + innerW / 2;
    return padL + plotInset + (i / (n - 1)) * (innerW - plotInset * 2);
  };
  const yAt = (v: number): number => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const ticks = [yMin, yMin + (yMax - yMin) / 2, yMax];
  const points: { i: number; x: number; y: number; v: number }[] = [];
  props.values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    points.push({ i, x: xAt(i), y: yAt(v), v });
  });
  const linePath = points
    .map((p, idx) => (idx === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1))
    .join(" ");
  const areaPath =
    points.length >= 2
      ? linePath +
        " L" +
        points[points.length - 1].x.toFixed(1) +
        " " +
        (padT + innerH).toFixed(1) +
        " L" +
        points[0].x.toFixed(1) +
        " " +
        (padT + innerH).toFixed(1) +
        " Z"
      : "";
  const xLabels =
    n <= 8
      ? props.labels.map((d, i) => ({ i, label: d.slice(5) }))
      : [0, Math.floor((n - 1) / 2), n - 1].map((i) => ({ i, label: props.labels[i].slice(5) }));

  return (
    <figure className="history-chart-card" style={{ margin: 0 }}>
      <figcaption style={{ ...theme.font.caption, color: theme.text.secondary, fontWeight: theme.weight.semibold, marginBottom: 4 }}>
        {props.title}
      </figcaption>
      <svg
        viewBox={"0 0 " + w + " " + h}
        className="history-chart"
        data-testid={props.testId}
        role="img"
        aria-label={props.title}
      >
        <defs>
          <linearGradient id={"bar-" + uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.brand.primary} stopOpacity="0.95" />
            <stop offset="100%" stopColor={theme.text.accent} stopOpacity="0.68" />
          </linearGradient>
          <linearGradient id={"area-" + uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.brand.primary} stopOpacity="0.22" />
            <stop offset="100%" stopColor={theme.brand.primary} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={yAt(t)}
              x2={padL + innerW}
              y2={yAt(t)}
              stroke={i === 0 ? theme.border.default : theme.border.subtle}
              strokeDasharray={i === 0 ? undefined : "2 3"}
              strokeWidth="1"
            />
            <text
              x={padL - 7}
              y={yAt(t) + 3}
              textAnchor="end"
              fill={theme.text.tertiary}
              fontSize="9"
              fontFamily={theme.font.family}
            >
              {props.formatTick(t)}
            </text>
          </g>
        ))}
        {props.kind === "bar"
          ? props.values.map((v, i) => {
              if (v == null || !Number.isFinite(v) || v <= 0) return null;
              const y = yAt(v);
              const bh = padT + innerH - y;
              return (
                <rect
                  key={props.labels[i]}
                  x={xAt(i) - barW / 2}
                  y={y}
                  width={barW}
                  height={Math.max(2, bh)}
                  rx="3"
                  fill={"url(#bar-" + uid + ")"}
                >
                  <title>
                    {props.labels[i]} {props.formatValue(v)}
                  </title>
                </rect>
              );
            })
          : null}
        {props.kind === "line" && areaPath ? (
          <path d={areaPath} fill={"url(#area-" + uid + ")"} />
        ) : null}
        {props.kind === "line" && linePath ? (
          <path d={linePath} fill="none" stroke={theme.brand.primary} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {props.kind === "line"
          ? points.map((p) => (
              <circle
                key={props.labels[p.i]}
                cx={p.x}
                cy={p.y}
                r="3"
                fill={theme.brand.primary}
                stroke={theme.bg.elevated}
                strokeWidth="1.5"
              >
                <title>
                  {props.labels[p.i]} {props.formatValue(p.v)}
                </title>
              </circle>
            ))
          : null}
        {xLabels.map((x) => (
          <text
            key={x.i}
            x={xAt(x.i)}
            y={h - 6}
            textAnchor="middle"
            fill={theme.text.tertiary}
            fontSize="9"
            fontFamily={theme.font.family}
          >
            {x.label}
          </text>
        ))}
      </svg>
      {numeric.length === 0 ? (
        <p style={{ ...theme.font.caption, color: theme.text.tertiary, margin: "0 0 4px" }}>這段期間還沒有資料。</p>
      ) : null}
    </figure>
  );
}
