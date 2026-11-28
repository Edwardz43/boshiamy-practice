import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import type { GrokTheme } from "./theme";
import type { Table } from "./articleText";
import { lookup } from "./articleText";
import type { Variants } from "./lookupLogic";
import { getSimplifiedHints } from "./simplifiedLogic";
import { SimpHintBar } from "./SimpHintBar";
import { KeycapBreakdown } from "./KeycapBreakdown";
import { OnScreenKeyboard } from "./OnScreenKeyboard";
import { IconGearButton, MobileShell } from "./MobileChrome";
import { BrandMark } from "./ThemePicker";
import { useIsTouch } from "./useIsMobile";
import { createBag, drawFromBag, type DrawBag } from "./drawLogic";
import { playKeySound } from "./sound";

type WordItem = { c: string; k: string[]; a?: string[] };
type Verdict = "idle" | "ok" | "bad";

function up(s: string): string {
  return s.toUpperCase();
}
function fmtCodes(codes: string[]): string {
  return codes.map(up).join("／");
}
function hintOf(item: WordItem): string {
  const minL = Math.min(...item.k.map((x) => x.length));
  return Array.from(new Set(item.k.filter((x) => x.length === minL).map((x) => up(x[0])))).join(" 或 ");
}

export function WordbookPractice(props: {
  theme: GrokTheme;
  isMobile: boolean;
  reps: Record<string, string>;
  table: Table;
  vars: Variants | null;
  wordbook: string[];
  autoNext: boolean;
  soundOn: boolean;
  sheetOpen?: boolean;
  onAttempt?: (info: { ch: string; correct: boolean; ms: number }) => void;
  onRemoveWordbook: (ch: string) => void;
  onBack: () => void;
  onOpenSettings: () => void;
  mobileModeStrip?: ReactNode;
  mobileTodayBar?: ReactNode;
  mobileSheets?: ReactNode;
}): JSX.Element {
  const { theme, isMobile, reps, table, vars, wordbook, autoNext, soundOn } = props;
  const isTouch = useIsTouch();

  const pool = useMemo<WordItem[]>(() => {
    const out: WordItem[] = [];
    for (const c of wordbook) {
      const e = lookup(table, c);
      if (e && e.k.length > 0) out.push({ c, k: e.k, a: e.a });
    }
    return out;
  }, [wordbook, table]);

  const bagRef = useRef<DrawBag>(createBag());
  const [cur, setCur] = useState<WordItem | null>(null);
  const [typed, setTyped] = useState("");
  const [hintOn, setHintOn] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>("idle");
  const [usedSelect, setUsedSelect] = useState(false);
  const [sessionOk, setSessionOk] = useState(0);
  const [sessionTried, setSessionTried] = useState(0);
  const [animTick, setAnimTick] = useState(0);
  const qStartedAt = useRef<number>(Date.now());
  const autoNextRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function clearAutoNext(): void {
    if (autoNextRef.current != null) {
      window.clearTimeout(autoNextRef.current);
      autoNextRef.current = null;
    }
  }

  function nextWord(list: WordItem[] = pool): void {
    clearAutoNext();
    const item = drawFromBag(bagRef.current, list, (x) => x.c);
    setCur(item);
    setTyped("");
    setHintOn(false);
    setVerdict("idle");
    setUsedSelect(false);
    qStartedAt.current = Date.now();
  }

  useEffect(() => {
    if (pool.length === 0) {
      clearAutoNext();
      setCur(null);
      return;
    }
    if (!cur || !pool.some((x) => x.c === cur.c)) {
      nextWord(pool);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  useEffect(() => () => clearAutoNext(), []);

  useEffect(() => {
    if (!isMobile && cur && verdict === "idle") {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [isMobile, cur, verdict]);

  function submit(raw: string): void {
    if (!cur || verdict !== "idle") return;
    const code = raw.trim().toLowerCase();
    if (!code) return;
    const direct = cur.k.includes(code);
    const select = !direct && !!cur.a?.includes(code);
    const ok = direct || select;
    const now = Date.now();
    const ms = Math.max(0, now - qStartedAt.current);
    setUsedSelect(select);
    setVerdict(ok ? "ok" : "bad");
    setAnimTick((n) => n + 1);
    setSessionTried((n) => n + 1);
    if (ok) setSessionOk((n) => n + 1);
    props.onAttempt?.({ ch: cur.c, correct: ok, ms });
    if (ok && autoNext) {
      clearAutoNext();
      autoNextRef.current = window.setTimeout(() => {
        autoNextRef.current = null;
        nextWord();
      }, 600);
    }
  }

  function onEnterLike(): void {
    if (verdict !== "idle") {
      nextWord();
    } else {
      submit(typed);
    }
  }

  useEffect(() => {
    const h = (ev: KeyboardEvent): void => {
      if (props.sheetOpen) return;
      if (ev.altKey || ev.metaKey || ev.ctrlKey) return;
      if (!cur) return;
      const k = ev.key;
      if (isMobile) {
        if (verdict === "idle" && /^[a-zA-Z]$/.test(k)) {
          ev.preventDefault();
          if (soundOn) playKeySound();
          setTyped((t) => (t + k.toLowerCase()).slice(0, 6));
          return;
        }
        if (k === "Backspace") {
          ev.preventDefault();
          setTyped((t) => t.slice(0, -1));
          return;
        }
      }
      if (k === "Enter" || k === " ") {
        ev.preventDefault();
        onEnterLike();
        return;
      }
      if (k === "/") {
        ev.preventDefault();
        if (verdict === "idle") setHintOn(true);
        return;
      }
      if (k === "Escape") {
        ev.preventDefault();
        nextWord();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const simpHints = useMemo(() => (cur ? getSimplifiedHints(cur.c, table, vars) : []), [cur, table, vars]);
  const primaryCode = cur ? cur.k[0] : "";
  const altCode = cur && cur.k[1] ? (cur.k.find((x) => x.length >= 3) ?? cur.k[1]) : undefined;

  const breakdown = (code: string): string =>
    code
      .split("")
      .map((ch) => up(ch) + (reps[ch] ? " " + reps[ch] : ""))
      .join("；");

  const explain = cur
    ? "字碼 " +
      fmtCodes(cur.k) +
      (usedSelect ? "（剛才輸入的是選字碼，建議記直接出字碼）" : "") +
      "。"
    : "";

  const stageBody = !cur ? (
    <div className="stage-center" data-testid="wordbook-practice-empty">
      <p style={{ ...theme.font.body1, color: theme.text.secondary, margin: 0 }}>
        生字本目前沒有可練習的字。回到查碼把不熟的字按「★」收進來吧！
      </p>
      <button type="button" className="ui-btn ui-btn-primary" data-testid="wordbook-back-btn" onClick={props.onBack}>
        返回查碼
      </button>
    </div>
  ) : (
    <div className={isMobile ? "mobile-q" : "stage-center"} data-testid="wordbook-practice-stage" data-answer={primaryCode}>
      <div className="wordbook-practice-bar">
        <button type="button" className="ui-pill" data-testid="wordbook-back-btn" onClick={props.onBack}>
          ← 返回查碼
        </button>
        <span className="stage-meta">
          生字本複習 · 共 {pool.length} 字{sessionTried > 0 ? ` · 本輪 ${sessionOk}/${sessionTried}` : ""}
        </span>
        <button
          type="button"
          className="ui-pill"
          data-testid="wordbook-remove-cur-btn"
          title="已練熟，移出生字本"
          onClick={() => props.onRemoveWordbook(cur.c)}
        >
          ✓ 已熟練移出
        </button>
      </div>

      <div
        key={verdict === "idle" ? "idle" : "v-" + animTick}
        data-testid="wordbook-glyph"
        className={
          (isMobile ? "mobile-glyph" : "glyph-stage") +
          (verdict === "ok" ? (isMobile ? " flash-ok" : " is-ok") : verdict === "bad" ? (isMobile ? " flash-bad" : " is-bad") : "")
        }
      >
        {cur.c}
      </div>

      {isMobile ? (
        <div
          className={"mobile-typed" + (typed ? "" : " is-empty")}
          style={{
            borderColor: verdict === "ok" ? theme.text.success : verdict === "bad" ? theme.text.danger : undefined,
            background: verdict === "ok" ? theme.fill.successSoft : verdict === "bad" ? theme.fill.dangerSoft : undefined,
          }}
          data-testid="wordbook-typed-display"
        >
          {typed ? up(typed) : isTouch ? "點下面鍵盤輸入" : "直接打字輸入"}
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            data-testid="wordbook-input"
            value={typed}
            onChange={(e) => {
              const next = e.target.value;
              if (soundOn && next.length > typed.length) playKeySound();
              setTyped(next);
            }}
            aria-label="生字本複習字碼"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            lang="en"
            inputMode="text"
            maxLength={6}
            className={"code-input" + (verdict === "ok" ? " is-ok" : verdict === "bad" ? " is-bad" : "")}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              disabled={verdict !== "idle" && false}
              onClick={onEnterLike}
            >
              {verdict !== "idle" ? "下一題" : "送出"}
              <kbd className="ui-kbd">Enter</kbd>
            </button>
            <button
              type="button"
              className="ui-btn"
              disabled={verdict !== "idle"}
              onClick={() => setHintOn(true)}
            >
              提示<kbd className="ui-kbd">/</kbd>
            </button>
            <button type="button" className="ui-btn" onClick={() => nextWord()}>
              跳過<kbd className="ui-kbd">Esc</kbd>
            </button>
          </div>
        </>
      )}

      {hintOn && verdict === "idle" ? (
        <p style={{ ...theme.font.body1, color: theme.text.accent, margin: 0, fontWeight: theme.weight.semibold }}>
          第一碼是 {hintOf(cur)}
        </p>
      ) : null}

      {verdict === "ok" ? (
        <div style={{ textAlign: "center", maxWidth: 520 }} data-testid="wordbook-feedback-ok">
          <p style={{ ...theme.font.body1, color: theme.text.success, margin: "0 0 6px", fontWeight: theme.weight.semibold }}>
            答對了。{explain}
          </p>
          <p style={{ ...theme.font.caption, color: theme.text.secondary, margin: 0 }}>
            字根：{breakdown(primaryCode)}
          </p>
          <KeycapBreakdown code={primaryCode} verdict="ok" reps={reps} compact={isMobile} />
          <SimpHintBar hints={simpHints} reps={reps} shownCodes={[primaryCode]} compact={isMobile} />
        </div>
      ) : null}

      {verdict === "bad" ? (
        <div style={{ textAlign: "center", maxWidth: 520 }} data-testid="wordbook-feedback-bad">
          <p style={{ ...theme.font.body1, color: theme.text.danger, margin: "0 0 6px", fontWeight: theme.weight.semibold }}>
            不對。{explain}
          </p>
          <p style={{ ...theme.font.caption, color: theme.text.secondary, margin: 0 }}>
            字根：{breakdown(primaryCode)}
            {altCode ? "　另一碼：" + breakdown(altCode) : ""}
          </p>
          <KeycapBreakdown
            code={primaryCode}
            altCode={altCode}
            altLabel="另一碼"
            typedCode={typed}
            verdict="bad"
            reps={reps}
            compact={isMobile}
          />
          <SimpHintBar
            hints={simpHints}
            reps={reps}
            shownCodes={altCode ? [primaryCode, altCode] : [primaryCode]}
            compact={isMobile}
          />
        </div>
      ) : null}
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
          <div className="mobile-header-stats">生字本複習 · {pool.length} 字</div>
        </div>
        <IconGearButton theme={theme} onClick={props.onOpenSettings} />
      </header>
    );
    const footer = cur ? (
      <OnScreenKeyboard
        theme={theme}
        reps={reps}
        showRoots={hintOn || verdict !== "idle"}
        collapsible={!isTouch}
        disabled={verdict !== "idle"}
        submitLabel={verdict !== "idle" ? "下一題" : "送出"}
        submitDisabled={verdict === "idle" && typed.trim() === ""}
        hintDisabled={verdict !== "idle"}
        onLetter={(k) => {
          if (verdict !== "idle") return;
          if (soundOn) playKeySound();
          setTyped((t) => (t + k).slice(0, 6));
        }}
        onDelete={() => {
          if (verdict !== "idle") return;
          setTyped((t) => t.slice(0, -1));
        }}
        onHint={() => setHintOn(true)}
        onSkip={() => nextWord()}
        onSubmit={onEnterLike}
      />
    ) : (
      <div className="os-actions">
        <button type="button" className="os-action is-primary" onClick={props.onBack} style={{ minHeight: 52 }}>
          返回查碼
        </button>
      </div>
    );
    return (
      <MobileShell
        theme={theme}
        answer={primaryCode}
        header={header}
        modeStrip={props.mobileModeStrip}
        todayBar={props.mobileTodayBar}
        stage={stageBody}
        footer={footer}
        sheets={props.mobileSheets}
      />
    );
  }

  return <section className="stage-card">{stageBody}</section>;
}
