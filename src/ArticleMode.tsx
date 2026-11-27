import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { GrokTheme } from "./theme";
import { OnScreenKeyboard } from "./OnScreenKeyboard";
import { IconGearButton, MobileShell } from "./MobileChrome";
import { BrandMark } from "./ThemePicker";
import { WIKI_URL, pickArticle, type Article, type Table } from "./articleText";
import type { Variants } from "./lookupLogic";
import { getSimplifiedHints } from "./simplifiedLogic";
import { SimpHintBar } from "./SimpHintBar";
import { KeycapBreakdown } from "./KeycapBreakdown";
import { useIsTouch } from "./useIsMobile";

type Status = "loading" | "error" | "ready" | "done";
type Mark = "ok" | "bad" | "skip";

let tablePromise: Promise<Table> | null = null;
function loadTable(): Promise<Table> {
  if (!tablePromise) {
    tablePromise = fetch("./liu-table.json")
      .then((r) => {
        if (!r.ok) throw new Error("table " + r.status);
        return r.json() as Promise<Table>;
      })
      .catch((e) => {
        tablePromise = null;
        throw e;
      });
  }
  return tablePromise;
}

let variantsPromise: Promise<Variants | null> | null = null;
// 繁簡對照 is a nice-to-have: if it fails to load, 文章練習 still works without it.
function loadVariants(): Promise<Variants | null> {
  if (!variantsPromise) {
    variantsPromise = fetch("./opencc-chars.json")
      .then((r) => {
        if (!r.ok) throw new Error("variants " + r.status);
        return r.json() as Promise<Variants>;
      })
      .catch(() => {
        variantsPromise = null;
        return null;
      });
  }
  return variantsPromise;
}

async function fetchArticle(table: Table): Promise<Article> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(WIKI_URL, { signal: ctl.signal });
      if (!r.ok) throw new Error("wiki " + r.status);
      const d = (await r.json()) as { query?: { pages?: Parameters<typeof pickArticle>[0] } };
      const art = pickArticle(d.query?.pages ?? [], table);
      if (art) return art;
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw new Error("no-suitable");
}

function up(s: string): string {
  return s.toUpperCase();
}
function fmt(codes: string[]): string {
  return codes.map(up).join("／");
}
function hintOf(k: string[]): string {
  const minL = Math.min(...k.map((x) => x.length));
  return Array.from(new Set(k.filter((x) => x.length === minL).map((x) => up(x[0])))).join(" 或 ");
}

export default function ArticleMode(props: {
  theme: GrokTheme;
  isMobile: boolean;
  reps: Record<string, string>;
  sheetOpen: boolean;
  bestCpm?: number;
  onMiss: (ch: string) => void;
  onAttempt?: (info: { correct: boolean; ms: number }) => void;
  onFinish?: (info: { cpm: number; accuracy: number }) => void;
  onActiveChange?: (info: { code: string; hintOn: boolean; bad: boolean; typed: string }) => void;
  onOpenSettings: () => void;
  mobileModeStrip?: ReactNode;
  mobileTodayBar?: ReactNode;
  mobileSheets?: ReactNode;
}): JSX.Element {
  const { theme, isMobile } = props;
  const isTouch = useIsTouch();
  const [status, setStatus] = useState<Status>("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  const [art, setArt] = useState<Article | null>(null);
  const [idx, setIdx] = useState<number>(-1);
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [typed, setTyped] = useState<string>("");
  const [hintOn, setHintOn] = useState<boolean>(false);
  const [bad, setBad] = useState<boolean>(false);
  const [flash, setFlash] = useState<number>(-1);
  const [t0, setT0] = useState<number | null>(null);
  const [t1, setT1] = useState<number | null>(null);
  const [vars, setVars] = useState<Variants | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const curRef = useRef<HTMLSpanElement | null>(null);
  const badFeedbackRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<Table | null>(null);
  const reqId = useRef(0);
  const lastMarkAt = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const [isNewBest, setIsNewBest] = useState(false);

  function firstCodable(a: Article, from: number): number {
    for (let i = from; i < a.segs.length; i++) if (a.segs[i].k) return i;
    return -1;
  }

  function begin(a: Article): void {
    setArt(a);
    setMarks({});
    setTyped("");
    setHintOn(false);
    setBad(false);
    setT0(null);
    setT1(null);
    setIsNewBest(false);
    finishedRef.current = false;
    lastMarkAt.current = null;
    const i = firstCodable(a, 0);
    setIdx(i);
    setStatus(i < 0 ? "done" : "ready");
  }

  async function load(): Promise<void> {
    const id = ++reqId.current;
    setStatus("loading");
    setErrMsg("");
    void loadVariants().then((v) => {
      if (v) setVars(v);
    });
    let table: Table;
    try {
      table = await loadTable();
      tableRef.current = table;
    } catch {
      if (id !== reqId.current) return;
      setErrMsg("碼表載入失敗。請確認網路後重試；載入過一次之後離線也能查碼。");
      setStatus("error");
      return;
    }
    try {
      const a = await fetchArticle(table);
      if (id !== reqId.current) return;
      begin(a);
    } catch (e) {
      if (id !== reqId.current) return;
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setErrMsg(
        offline
          ? "目前沒有網路，抓不到維基百科文章。連上網路後再按重試。"
          : String((e as Error)?.message) === "no-suitable"
            ? "連抓了幾批都太短或外文太多，再試一次看看。"
            : "連不上維基百科（可能網路不穩或被擋）。請稍後按重試。",
      );
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
    return () => {
      reqId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cur = art && idx >= 0 ? art.segs[idx] : null;
  const curSimpHints = useMemo(() => (cur ? getSimplifiedHints(cur.c, tableRef.current, vars) : []), [cur, vars]);

  useEffect(() => {
    props.onActiveChange?.({
      code: cur && cur.k ? cur.k[0] : "",
      hintOn,
      bad,
      typed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, hintOn, bad, typed]);

  const stats = useMemo(() => {
    const vals = Object.values(marks);
    const okN = vals.filter((m) => m === "ok").length;
    const badN = vals.filter((m) => m === "bad").length;
    const skipN = vals.filter((m) => m === "skip").length;
    return { okN, badN, skipN, done: vals.length };
  }, [marks]);

  const missed = useMemo(() => {
    if (!art) return [] as { c: string; k: string[]; a?: string[] }[];
    const seen = new Set<string>();
    const out: { c: string; k: string[]; a?: string[] }[] = [];
    Object.keys(marks)
      .map(Number)
      .sort((x, y) => x - y)
      .forEach((i) => {
        const s = art.segs[i];
        if ((marks[i] === "bad" || marks[i] === "skip") && s.k && !seen.has(s.c)) {
          seen.add(s.c);
          out.push({ c: s.c, k: s.k, a: s.a });
        }
      });
    return out;
  }, [art, marks]);

  useEffect(() => {
    const el = curRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [idx, status]);

  useEffect(() => {
    if (isMobile || status !== "ready") return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [isMobile, status, idx, bad]);

  function startClock(): void {
    if (t0 == null) {
      const n = Date.now();
      setT0(n);
      if (lastMarkAt.current == null) lastMarkAt.current = n;
    }
  }

  function advance(mark: Mark): void {
    if (!art) return;
    const now = Date.now();
    startClock();
    const started = lastMarkAt.current ?? now;
    const ms = Math.min(5 * 60 * 1000, Math.max(0, now - started));
    lastMarkAt.current = now;
    const alreadyBad = marks[idx] === "bad";
    const correct = mark === "ok" && !alreadyBad;
    props.onAttempt?.({ correct, ms });
    setMarks((m) => ({ ...m, [idx]: m[idx] === "bad" ? "bad" : mark }));
    setTyped("");
    setHintOn(false);
    setBad(false);
    const n = firstCodable(art, idx + 1);
    if (n < 0) {
      setT1(Date.now());
      setIdx(-1);
      setStatus("done");
    } else setIdx(n);
  }

  function submit(): void {
    if (!cur || !cur.k || status !== "ready") return;
    if (bad) {
      advance("bad");
      return;
    }
    const code = typed.trim().toLowerCase();
    if (!code) return;
    startClock();
    const good = cur.k.includes(code) || (cur.a ?? []).includes(code);
    if (good) {
      setFlash(idx);
      window.setTimeout(() => setFlash((f) => (f === idx ? -1 : f)), 500);
      advance("ok");
    } else {
      setBad(true);
      setMarks((m) => ({ ...m, [idx]: "bad" }));
      props.onMiss(cur.c);
    }
  }

  function skip(): void {
    if (!cur || status !== "ready") return;
    startClock();
    if (!bad) props.onMiss(cur.c);
    advance(bad ? "bad" : "skip");
  }

  function retype(): void {
    if (art) begin(art);
  }

  function typeLetter(l: string): void {
    if (bad || status !== "ready") return;
    startClock();
    setTyped((t) => (t + l.toLowerCase()).slice(0, 6));
  }

  useEffect(() => {
    const h = (ev: globalThis.KeyboardEvent): void => {
      if (ev.isComposing || props.sheetOpen) return;
      if (ev.altKey) {
        if (ev.code === "KeyN") {
          ev.preventDefault();
          void load();
        }
        return;
      }
      if (ev.metaKey || ev.ctrlKey) return;
      const k = ev.key;
      const go = k === "Enter" || k === " ";
      if (status === "loading") return;
      if (status === "error") {
        if (go) {
          ev.preventDefault();
          void load();
        }
        return;
      }
      if (status === "done") {
        if (go) {
          ev.preventDefault();
          void load();
        } else if (k === "r" || k === "R") {
          ev.preventDefault();
          retype();
        }
        return;
      }
      if (go) {
        ev.preventDefault();
        submit();
        return;
      }
      if (k === "/") {
        ev.preventDefault();
        if (!bad) setHintOn(true);
        return;
      }
      if (k === "Escape") {
        ev.preventDefault();
        skip();
        return;
      }
      if (isMobile) {
        if (/^[a-zA-Z]$/.test(k)) {
          ev.preventDefault();
          typeLetter(k);
        } else if (k === "Backspace") {
          ev.preventDefault();
          if (!bad) setTyped((t) => t.slice(0, -1));
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const secs = t0 != null ? Math.max(1, Math.round(((t1 ?? Date.now()) - t0) / 1000)) : 0;
  const cpm = secs > 0 ? Math.round((stats.okN / secs) * 60) : 0;
  const total = stats.done;
  const acc = total > 0 ? Math.round((stats.okN / total) * 100) + "%" : "—";
  const mmss = Math.floor(secs / 60) + " 分 " + (secs % 60) + " 秒";

  const passage =
    art != null ? (
      <div
        className="article-passage"
        data-testid="article-passage"
        style={{
          borderColor: theme.border.default,
          background: isMobile ? theme.bg.elevated : theme.bg.base,
          color: theme.text.primary,
        }}
      >
        {art.segs.map((s, i) => {
          const m = marks[i];
          const isCur = i === idx && status === "ready";
          let style: CSSProperties | undefined;
          if (!s.k) style = { color: theme.text.tertiary };
          else if (isCur)
            style = {
              background: bad ? theme.fill.dangerSoft : theme.fill.primarySoft,
              outline: "2px solid " + (bad ? theme.text.danger : theme.brand.primary),
              borderRadius: 4,
            };
          else if (m === "ok")
            style = {
              color: theme.text.success,
              background: theme.fill.successSoft,
              borderRadius: 3,
            };
          else if (m === "bad" || m === "skip")
            style = {
              color: theme.text.danger,
              background: theme.fill.dangerSoft,
              borderRadius: 3,
              textDecoration: "underline wavy",
            };
          return (
            <span
              key={i}
              ref={isCur ? curRef : undefined}
              className={flash === i ? "article-flash" : undefined}
              style={style}
            >
              {s.c}
            </span>
          );
        })}
      </div>
    ) : null;

  const titleRow = art ? (
    <p className="article-title" style={{ color: theme.text.secondary }}>
      維基百科：
      <a href={art.url} target="_blank" rel="noopener noreferrer" style={{ color: theme.text.accent }}>
        {art.title}
      </a>
    </p>
  ) : null;

  useEffect(() => {
    if (!isMobile || !bad) return;
    badFeedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isMobile, bad, idx]);

  const curMsg =
    cur && cur.k ? (
      bad ? (
        <div ref={badFeedbackRef} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <p className="mobile-msg" style={{ color: theme.text.danger, fontWeight: theme.weight.semibold, margin: 0 }}>
            不對。「{cur.c}」的字碼是 {fmt(cur.k)}
            {cur.a && cur.a.length ? "（要選字：" + fmt(cur.a) + "）" : ""}
            <br />
            <span style={{ color: theme.text.secondary, fontWeight: theme.weight.regular, fontSize: 12 }}>
              字根：
              {cur.k[0]
                .split("")
                .map((ch) => up(ch) + "　" + (props.reps[ch] ?? ""))
                .join("；")}
              。按{isMobile && isTouch ? "「下一字」" : "空白鍵或 Enter"}繼續。
            </span>
          </p>
          <KeycapBreakdown
            code={cur.k[0]}
            typedCode={typed}
            verdict="bad"
            reps={props.reps}
            compact={isMobile}
          />
          <SimpHintBar
            hints={curSimpHints}
            reps={props.reps}
            shownCodes={cur.k[0] ? [cur.k[0]] : []}
            compact={isMobile}
          />
        </div>
      ) : hintOn ? (
        <p className="mobile-msg" style={{ color: theme.text.accent, fontWeight: theme.weight.semibold, margin: 0 }}>
          第一碼是 {hintOf(cur.k)}
        </p>
      ) : (
        <p className="mobile-caption" style={{ margin: 0 }}>
          打目前框起來的字，答對自動跳下一字；灰色的標點、外文和數字會自動略過。
        </p>
      )
    ) : null;

  const progress =
    art && status === "ready"
      ? "第 " + (stats.done + 1) + " / " + art.codable + " 字 · 答對 " + stats.okN
      : art && status === "done"
        ? "完成 · 正確率 " + acc
        : "文章練習";

  const progressPct = art && art.codable > 0 ? Math.min(100, Math.round((stats.done / art.codable) * 100)) : 0;

  const progressBar =
    art && (status === "ready" || status === "done") ? (
      <div className="article-progress-track" aria-hidden="true">
        <div
          className="article-progress-fill"
          style={{ width: (status === "done" ? 100 : progressPct) + "%" }}
        />
      </div>
    ) : null;

  const accNum = total > 0 ? Math.round((stats.okN / total) * 100) : 0;
  useEffect(() => {
    if (status === "done" && !finishedRef.current) {
      finishedRef.current = true;
      if (cpm > 0 && (props.bestCpm == null || cpm > props.bestCpm)) {
        setIsNewBest(true);
      }
      props.onFinish?.({ cpm, accuracy: accNum });
    }
  }, [status, cpm, accNum, props.bestCpm, props.onFinish]);

  const resultTier =
    accNum === 100 && total > 0
      ? "完美通關"
      : accNum >= 92
        ? "手感極佳"
        : accNum >= 80
          ? "穩健完成"
          : "繼續累積";

  const result =
    status === "done" && art ? (
      <div className="article-result" data-testid="article-result">
        <div className="article-result-head">
          <span className={"article-badge" + (accNum >= 92 ? " is-great" : "")}>{resultTier}</span>
          {isNewBest ? (
            <span className="timed-new-best-badge" data-testid="article-new-best">
              🏆 新最快紀錄！
            </span>
          ) : null}
          <h2 style={{ ...theme.font.heading2, margin: 0, fontWeight: theme.weight.semibold }}>打完了！</h2>
        </div>
        <p style={{ ...theme.font.body1, color: theme.text.secondary, margin: 0 }}>
          正確率 {acc}（{stats.okN} / {total} 字），用時 {mmss}，每分鐘 {cpm} 字。
        </p>
        <div className="article-result-grid">
          <div className="article-result-stat">
            <span className="article-result-label">速度</span>
            <span className="article-result-val">{cpm} 字/分</span>
          </div>
          <div className="article-result-stat">
            <span className="article-result-label">正確率</span>
            <span className="article-result-val">{acc}</span>
          </div>
          <div className="article-result-stat">
            <span className="article-result-label">用時</span>
            <span className="article-result-val">{mmss}</span>
          </div>
        </div>
        {missed.length ? (
          <div style={{ width: "100%" }}>
            <p style={{ ...theme.font.caption, color: theme.text.tertiary, margin: "0 0 6px" }}>
              這篇打錯或跳過的字（共 {missed.length} 字）
            </p>
            <ul className="article-missed">
              {missed.map((x) => (
                <li key={x.c} className="article-missed-item" style={{ borderColor: theme.border.default }}>
                  <span className="article-missed-char">{x.c}</span>
                  <span className="article-missed-code" style={{ color: theme.text.accent }}>
                    {fmt(x.k.slice(0, 2))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ ...theme.font.body1, color: theme.text.success, margin: 0 }}>全部答對，沒有錯字。</p>
        )}
      </div>
    ) : null;

  const loadingEl =
    status === "loading" ? (
      <p className="mobile-msg" style={{ color: theme.text.secondary }} data-testid="article-loading">
        正在從維基百科抓一篇文章…
      </p>
    ) : null;

  const errorEl =
    status === "error" ? (
      <div className="article-result" data-testid="article-error">
        <p style={{ ...theme.font.body1, color: theme.text.accent, margin: 0 }}>{errMsg}</p>
      </div>
    ) : null;

  if (isMobile) {
    const header = (
      <header className="mobile-header">
        <div className="mobile-header-text">
          <div className="mobile-brand-row">
            <BrandMark size={26} />
            <h1 style={{ fontWeight: theme.weight.semibold }}>無蝦米練功房</h1>
          </div>
          <div className="mobile-header-stats">
            {progress}
          </div>
        </div>
        <IconGearButton theme={theme} onClick={props.onOpenSettings} />
      </header>
    );
    const stage = (
      <div className={"mobile-q article-q" + (bad ? " is-bad" : "")}>
        {loadingEl}
        {errorEl}
        {status === "ready" || status === "done" ? titleRow : null}
        {status === "ready" ? progressBar : null}
        {status === "ready" ? passage : null}
        {status === "ready" && cur ? (
          <div className="article-cur-row">
            <div className="article-cur-glyph" style={{ borderColor: bad ? theme.text.danger : theme.brand.primary }}>
              {cur.c}
            </div>
            <div
              className={"mobile-typed" + (typed ? "" : " is-empty")}
              style={{ borderColor: bad ? theme.text.danger : theme.border.strong }}
              data-testid="typed-display"
            >
              {typed ? up(typed) : isTouch ? "點鍵盤輸入" : "直接打字輸入"}
            </div>
          </div>
        ) : null}
        {status === "ready" ? curMsg : null}
        {result}
      </div>
    );
    let footer: JSX.Element;
    if (status === "ready") {
      footer = (
        <OnScreenKeyboard
          theme={theme}
          reps={props.reps}
          showRoots={hintOn || bad}
          collapsible={!isTouch}
          disabled={bad}
          submitLabel={bad ? "下一字" : "送出"}
          submitDisabled={!bad && typed.trim() === ""}
          hintDisabled={bad}
          onLetter={typeLetter}
          onDelete={() => !bad && setTyped((t) => t.slice(0, -1))}
          onHint={() => setHintOn(true)}
          onSkip={skip}
          onSubmit={submit}
        />
      );
    } else {
      footer = (
        <div className="os-actions">
          {status === "done" ? (
            <button type="button" className="os-action" onClick={retype} style={{ minHeight: 52 }}>
              重打這篇
            </button>
          ) : null}
          <button
            type="button"
            className="os-action is-primary"
            disabled={status === "loading"}
            onClick={() => void load()}
            style={{ minHeight: 52 }}
          >
            {status === "error" ? "重試" : status === "loading" ? "載入中…" : "再一篇"}
          </button>
        </div>
      );
    }
    return (
      <MobileShell
        theme={theme}
        answer={cur && cur.k ? cur.k[0] : ""}
        header={header}
        modeStrip={props.mobileModeStrip}
        todayBar={props.mobileTodayBar}
        stage={stage}
        footer={footer}
        sheets={props.mobileSheets}
      />
    );
  }

  const btn = (label: string, kbd: string | null, onClick: () => void, primary?: boolean, disabled?: boolean): JSX.Element => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={"ui-btn" + (primary ? " ui-btn-primary" : "")}
    >
      <span>{label}</span>
      {kbd ? <kbd className={"kbd" + (primary ? " kbd-on-primary" : "")}>{kbd}</kbd> : null}
    </button>
  );

  return (
    <section
      data-testid="article-desktop"
      className="stage-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div className="stage-meta">{progress}</div>
      {progressBar}
      {loadingEl}
      {errorEl}
      {status === "ready" || status === "done" ? titleRow : null}
      {status === "ready" ? passage : null}
      {status === "ready" && cur ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <div
              className={"glyph-stage" + (bad ? " is-bad" : "")}
              style={{ minWidth: 88, height: 88, fontSize: 48 }}
            >
              {cur.c}
            </div>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => {
                if (bad) return;
                startClock();
                setTyped(e.target.value.replace(/[^a-zA-Z]/g, "").toLowerCase().slice(0, 6));
              }}
              aria-label="文章練習字碼"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              lang="en"
              maxLength={6}
              readOnly={bad}
              className={"code-input" + (bad ? " is-bad" : "")}
              style={{ width: 200, maxWidth: 200 }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {btn(bad ? "下一字" : "送出", "Enter", submit, true, !bad && typed.trim() === "")}
            {btn("提示", "/", () => setHintOn(true), false, bad)}
            {btn("跳過此字", "Esc", skip)}
            {btn("換一篇", "⌥N", () => void load())}
          </div>
          <div style={{ textAlign: "center", maxWidth: 560 }}>{curMsg}</div>
        </>
      ) : null}
      {result}
      {status === "done" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {btn("再一篇", "Enter", () => void load(), true)}
          {btn("重打這篇", "R", retype)}
        </div>
      ) : null}
      {status === "error" ? btn("重試", "Enter", () => void load(), true) : null}
      <p style={{ ...theme.font.caption, color: theme.text.tertiary, margin: 0, textAlign: "center" }}>
        文章取自中文維基百科隨機條目的開頭（台灣正體），內容依 CC BY-SA 授權。快捷鍵：空白鍵／Enter 送出，/ 提示，Esc
        跳過此字，⌥N 換一篇。
      </p>
    </section>
  );
}
