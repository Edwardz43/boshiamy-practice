import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type JSX, type ReactNode } from "react";
import type { GrokTheme } from "./theme";
import { IconGearButton, MobileShell } from "./MobileChrome";
import {
  type BackupFile,
  type BackupSettings,
  type DrillMode,
  type HistoryStore,
  type ImportMode,
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
  localDate,
  makeBackup,
  oversizedBackupMessage,
  parseBackup,
  recentDays,
  rangeTotals,
  seriesFor,
  shareBackupFile,
  dayTotals,
} from "./historyLogic";

type RangeLen = 7 | 30;
type Filter = DrillMode | "all";

const FILTERS: { v: Filter; label: string }[] = [
  { v: "all", label: "全部" },
  { v: "roots", label: "字根" },
  { v: "chars", label: "常用字" },
  { v: "short", label: "簡碼" },
  { v: "timed", label: "限時" },
  { v: "article", label: "文章" },
];

export default function HistoryMode(props: {
  theme: GrokTheme;
  isMobile: boolean;
  history: HistoryStore;
  stats: SavedStats;
  settings: BackupSettings;
  onOpenSettings: () => void;
  onImport: (data: BackupFile, mode: ImportMode) => void;
  mobileSheets?: ReactNode;
}): JSX.Element {
  const { theme, isMobile, history } = props;
  const [range, setRange] = useState<RangeLen>(7);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const today = localDate();

  const rows = useMemo(() => seriesFor(history, today, range, filter), [history, today, range, filter]);
  const totals = useMemo(() => rangeTotals(history, today, range, filter), [history, today, range, filter]);
  const tableDays = useMemo(() => recentDays(history, 30), [history]);
  const canShare = useMemo(() => canShareBackupFiles(), []);

  const backup = (): BackupFile =>
    makeBackup({ stats: props.stats, history: props.history, settings: props.settings });

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

  const chip = (on: boolean): CSSProperties => ({
    ...theme.font.label,
    minHeight: 40,
    padding: "0 12px",
    borderRadius: theme.radius.full,
    border: "1px solid " + (on ? theme.border.strong : theme.border.default),
    background: on ? theme.bg.elevated : "transparent",
    color: theme.text.primary,
    fontWeight: on ? theme.weight.semibold : theme.weight.medium,
    cursor: "pointer",
  });

  const actionBtn = (label: string, onClick: () => void, testId: string, primary?: boolean): JSX.Element => (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        ...theme.font.label,
        minHeight: 44,
        padding: "0 18px",
        borderRadius: theme.radius.full,
        border: "1px solid " + (primary ? theme.border.strong : theme.border.default),
        background: primary ? theme.bg.elevated : "transparent",
        color: theme.text.primary,
        fontWeight: theme.weight.semibold,
        cursor: "pointer",
      }}
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
        { label: "題數", value: String(totals.tried) },
        { label: "正確率", value: formatPct(totals) },
        { label: "練習時間", value: totals.ms > 0 ? formatDuration(totals.ms) : "—" },
        {
          label: filter === "article" ? "速度" : "平均速度",
          value: formatSpeed(totals, filter),
        },
      ].map((s) => (
        <div
          key={s.label}
          className="history-stat"
          style={{ borderColor: theme.border.subtle, background: theme.bg.elevated }}
        >
          <div style={{ ...theme.font.caption, color: theme.text.tertiary }}>{s.label}</div>
          <div style={{ ...theme.font.heading3, fontWeight: theme.weight.semibold, marginTop: 2, overflowWrap: "anywhere" }}>
            {s.value}
          </div>
        </div>
      ))}
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
            onClick={() => setRange(n)}
            style={chip(range === n)}
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
            onClick={() => setFilter(f.v)}
            style={chip(filter === f.v)}
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
        <p data-testid="history-err" style={{ ...theme.font.caption, color: "#c0392b", margin: "8px 0 0" }}>
          {err}
        </p>
      ) : null}
    </div>
  );

  const body = (
    <div className="history-wrap" data-testid="history-root">
      {controls}
      {summary}
      {charts}
      {table}
      {backupBlock}
    </div>
  );

  if (isMobile) {
    const header = (
      <header className="mobile-header">
        <div className="mobile-header-text">
          <h1 style={{ fontWeight: theme.weight.semibold }}>無蝦米練功房</h1>
          <div className="mobile-header-stats" style={{ color: theme.text.secondary }}>
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
    return <MobileShell theme={theme} header={header} stage={body} footer={footer} sheets={props.mobileSheets} />;
  }

  return (
    <section
      data-testid="history-desktop"
      style={{
        background: theme.bg.elevated,
        border: "1px solid " + theme.border.default,
        borderRadius: 18,
        padding: 18,
        boxSizing: "border-box",
        width: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ ...theme.font.caption, color: theme.text.tertiary }}>紀錄</div>
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
  const w = 360;
  const h = 140;
  const padL = 36;
  const padR = 22;
  const padT = 12;
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
  const xAt = (i: number): number => {
    if (n <= 1) return padL + innerW / 2;
    return padL + (i / (n - 1)) * innerW;
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
  const barW = n > 0 ? Math.max(2, Math.min(16, (innerW / n) * 0.6)) : 8;
  const xLabels =
    n <= 8
      ? props.labels.map((d, i) => ({ i, label: d.slice(5) }))
      : [0, Math.floor((n - 1) / 2), n - 1].map((i) => ({ i, label: props.labels[i].slice(5) }));

  return (
    <figure className="history-chart-block" style={{ margin: 0 }}>
      <figcaption style={{ ...theme.font.caption, color: theme.text.secondary, marginBottom: 4 }}>{props.title}</figcaption>
      <svg
        viewBox={"0 0 " + w + " " + h}
        className="history-chart"
        data-testid={props.testId}
        role="img"
        aria-label={props.title}
      >
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke={theme.border.default} strokeWidth="1" />
        <line
          x1={padL}
          y1={padT + innerH}
          x2={padL + innerW}
          y2={padT + innerH}
          stroke={theme.border.default}
          strokeWidth="1"
        />
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={yAt(t)}
              x2={padL + innerW}
              y2={yAt(t)}
              stroke={theme.border.subtle}
              strokeWidth="1"
            />
            <text
              x={padL - 4}
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
                  height={Math.max(0, bh)}
                  rx="2"
                  fill={theme.text.accent}
                  opacity={0.85}
                >
                  <title>
                    {props.labels[i]} {props.formatValue(v)}
                  </title>
                </rect>
              );
            })
          : null}
        {props.kind === "line" && linePath ? (
          <path d={linePath} fill="none" stroke={theme.text.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {props.kind === "line"
          ? points.map((p) => (
              <circle key={props.labels[p.i]} cx={p.x} cy={p.y} r="2.6" fill={theme.text.accent}>
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
            textAnchor={x.i === 0 ? "start" : x.i === n - 1 ? "end" : "middle"}
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
