import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import type { GrokTheme } from "./theme";
import type { Table } from "./articleText";
import type { Variants } from "./lookupLogic";
import { loadTable, loadVariants } from "./tableLoader";
import {
  PHRASE_CATEGORIES,
  buildPhrasePool,
  gradePhraseChar,
  phraseCategoryLabel,
  type PhraseCategory,
  type ResolvedPhrase,
} from "./phraseLogic";
import { getSimplifiedHints } from "./simplifiedLogic";
import { SimpHintBar } from "./SimpHintBar";
import { KeycapBreakdown } from "./KeycapBreakdown";
import { OnScreenKeyboard } from "./OnScreenKeyboard";
import { IconGearButton, MobileShell } from "./MobileChrome";
import { BrandMark } from "./ThemePicker";
import { useIsTouch } from "./useIsMobile";
import { createBag, drawFromBag, type DrawBag } from "./drawLogic";
import { playKeySound } from "./sound";

type Status = "loading" | "error" | "ready";
type CharMark = "ok" | "skip";

function up(s: string): string {
  return s.toUpperCase();
}
function fmtCodes(codes: string[]): string {
  return codes.map(up).join("／");
}
function hintOf(k: string[]): string {
  const minL = Math.min(...k.map((x) => x.length));
  return Array.from(new Set(k.filter((x) => x.length === minL).map((x) => up(x[0])))).join(" 或 ");
}

export default function PhraseMode(props: {
  theme: GrokTheme;
  isMobile: boolean;
  reps: Record<string, string>;
  sheetOpen: boolean;
  soundOn?: boolean;
  onMiss: (ch: string) => void;
  onAttempt?: (info: { correct: boolean; ms: number }) => void;
  onActiveChange?: (info: { code: string; hintOn: boolean; bad: boolean; typed: string }) => void;
  onOpenSettings: () => void;
  mobileModeStrip?: ReactNode;
  mobileTodayBar?: ReactNode;
  mobileSheets?: ReactNode;
}): JSX.Element {
  const { theme, isMobile, reps, soundOn } = props;
  const isTouch = useIsTouch();

  const [status, setStatus] = useState<Status>("loading");
  const [table, setTable] = useState<Table | null>(null);
  const [vars, setVars] = useState<Variants | null>(null);
  const [cat, setCat] = useState<PhraseCategory>("daily");
  const [cur, setCur] = useState<ResolvedPhrase | null>(null);
  const [upcoming, setUpcoming] = useState<ResolvedPhrase | null>(null);
  const [charIdx, setCharIdx] = useState(0);
  const [marks, setMarks] = useState<Record<number, CharMark>>({});
  const [typed, setTyped] = useState("");
  const [hintOn, setHintOn] = useState(false);
  const [bad, setBad] = useState(false);
  const [phrasesDone, setPhrasesDone] = useState(0);
  const [charsOk, setCharsOk] = useState(0);
  const [charsTried, setCharsTried] = useState(0);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [pulseTick, setPulseTick] = useState(0);

  const bagRef = useRef<DrawBag>(createBag());
  const lastCharAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function load(): void {
    setStatus("loading");
    void loadVariants().then((v) => setVars(v));
    loadTable()
      .then((t) => {
        setTable(t);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  useEffect(() => {
    load();
  }, []);

  const pool = useMemo(() => (table ? buildPhrasePool(cat, table) : []), [table, cat]);

  function drawOne(list: ResolvedPhrase[]): ResolvedPhrase | null {
    return drawFromBag(bagRef.current, list, (p) => p.text);
  }

  useEffect(() => {
    if (status !== "ready" || pool.length === 0) return;
    bagRef.current = createBag();
    const first = drawOne(pool);
    const second = drawOne(pool);
    setCur(first);
    setUpcoming(second);
    setCharIdx(0);
    setMarks({});
    setTyped("");
    setHintOn(false);
    setBad(false);
    lastCharAt.current = null;
  }, [status, pool]);

  const activeChar = cur ? cur.chars[charIdx] ?? null : null;

  useEffect(() => {
    props.onActiveChange?.({
      code: activeChar?.k[0] ?? "",
      hintOn,
      bad,
      typed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChar, hintOn, bad, typed]);

  useEffect(() => {
    if (!isMobile && status === "ready" && activeChar && !props.sheetOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [isMobile, status, activeChar, props.sheetOpen]);

  function advancePhrase(completed: boolean): void {
    const nextCur = upcoming ?? drawOne(pool);
    const nextUp = drawOne(pool);
    setCur(nextCur);
    setUpcoming(nextUp);
    setCharIdx(0);
    setMarks({});
    setTyped("");
    setHintOn(false);
    setBad(false);
    if (completed) {
      setPhrasesDone((n) => n + 1);
      setPulseTick((n) => n + 1);
    }
  }

  function advanceChar(mark: CharMark): void {
    if (!cur) return;
    const nextIdx = charIdx + 1;
    if (nextIdx >= cur.chars.length) {
      advancePhrase(true);
    } else {
      setMarks((m) => ({ ...m, [charIdx]: mark }));
      setCharIdx(nextIdx);
      setTyped("");
      setHintOn(false);
      setBad(false);
    }
  }

  function submit(raw: string): void {
    if (!cur || !activeChar) return;
    const code = raw.trim().toLowerCase();
    if (!code) return;
    const now = Date.now();
    if (sessionStart == null) setSessionStart(now);
    const ms = lastCharAt.current != null ? Math.max(0, now - lastCharAt.current) : 0;
    lastCharAt.current = now;

    const res = gradePhraseChar(activeChar, code);
    setCharsTried((n) => n + 1);
    props.onAttempt?.({ correct: res.ok, ms });
    if (res.ok) {
      setCharsOk((n) => n + 1);
      advanceChar("ok");
    } else {
      setBad(true);
      props.onMiss(activeChar.c);
    }
  }

  function skipChar(): void {
    if (!cur || !activeChar) return;
    const now = Date.now();
    lastCharAt.current = now;
    props.onMiss(activeChar.c);
    advanceChar("skip");
  }

  function skipPhrase(): void {
    if (!cur) return;
    advancePhrase(false);
  }

  useEffect(() => {
    const h = (ev: KeyboardEvent): void => {
      if (props.sheetOpen || status !== "ready" || !activeChar) return;
      if (ev.altKey || ev.metaKey || ev.ctrlKey) return;
      const k = ev.key;
      if (isMobile) {
        if (/^[a-zA-Z]$/.test(k)) {
          ev.preventDefault();
          if (soundOn) playKeySound();
          setTyped((t) => (t + k.toLowerCase()).slice(0, 6));
          setBad(false);
          return;
        }
        if (k === "Backspace") {
          ev.preventDefault();
          setTyped((t) => t.slice(0, -1));
          setBad(false);
          return;
        }
      }
      if (k === "Enter" || k === " ") {
        ev.preventDefault();
        submit(typed);
        return;
      }
      if (k === "/") {
        ev.preventDefault();
        setHintOn(true);
        return;
      }
      if (k === "Escape") {
        ev.preventDefault();
        skipChar();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const simpHints = useMemo(
    () => (activeChar ? getSimplifiedHints(activeChar.c, table, vars) : []),
    [activeChar, table, vars],
  );

  const liveCpm = useMemo(() => {
    if (!sessionStart || charsOk === 0) return null;
    const mins = (Date.now() - sessionStart) / 60000;
    if (mins < 0.05) return null;
    return Math.round(charsOk / mins);
  }, [sessionStart, charsOk, charsTried]);

  const accText = charsTried > 0 ? Math.round((charsOk / charsTried) * 100) + "%" : "—";

  const catBar = (
    <div className="phrase-cat-bar" role="group" aria-label="詞彙分類" data-testid="phrase-cat-bar">
      {PHRASE_CATEGORIES.map((c) => (
        <button
          key={c.v}
          type="button"
          data-testid={"phrase-cat-" + c.v}
          aria-pressed={cat === c.v}
          className={"ui-pill" + (cat === c.v ? " is-on" : "")}
          onClick={() => setCat(c.v)}
        >
          {isMobile ? c.shortLabel : c.label}
        </button>
      ))}
    </div>
  );

  let stageContent: JSX.Element;
  if (status === "loading") {
    stageContent = (
      <div className="stage-center">
        <p style={{ ...theme.font.body1, color: theme.text.secondary, margin: 0 }}>載入詞彙碼表中…</p>
      </div>
    );
  } else if (status === "error") {
    stageContent = (
      <div className="stage-center">
        <p style={{ ...theme.font.body1, color: theme.text.secondary, margin: 0 }}>
          碼表載入失敗，請確認網路後重試。
        </p>
        <button type="button" className="ui-btn ui-btn-primary" onClick={load}>
          重試
        </button>
      </div>
    );
  } else if (!cur || !activeChar) {
    stageContent = (
      <div className="stage-center">
        <p style={{ ...theme.font.body1, color: theme.text.secondary, margin: 0 }}>目前沒有可練的詞彙。</p>
      </div>
    );
  } else {
    const primaryCode = activeChar.k[0];
    const altCode = activeChar.k[1] ? (activeChar.k.find((x) => x.length >= 3) ?? activeChar.k[1]) : undefined;
    stageContent = (
      <div
        className={isMobile ? "mobile-q phrase-stage" : "stage-center phrase-stage"}
        data-testid="phrase-stage"
        data-answer={primaryCode}
        data-phrase={cur.text}
        data-char-index={charIdx}
      >
        {catBar}

        <div className="phrase-stats-row">
          <span className="stage-meta">
            {phraseCategoryLabel(cat)} · 已完成 {phrasesDone} 詞 · 正確率 {accText}
            {liveCpm != null ? ` · ${liveCpm} 字/分` : ""}
          </span>
        </div>

        <div key={"p-" + pulseTick} className="phrase-glyph-row" data-testid="phrase-glyphs" aria-label={cur.text}>
          {cur.chars.map((ch, i) => {
            const st = i < charIdx ? marks[i] ?? "ok" : i === charIdx ? (bad ? "bad" : "cur") : "todo";
            return (
              <span
                key={cur.text + "-" + i}
                data-testid={"phrase-char-" + i}
                data-state={st}
                className={
                  "phrase-char" +
                  (st === "ok"
                    ? " is-done"
                    : st === "skip"
                      ? " is-skip"
                      : st === "bad"
                        ? " is-cur is-bad"
                        : st === "cur"
                          ? " is-cur"
                          : "")
                }
              >
                {ch.c}
              </span>
            );
          })}
        </div>

        {upcoming ? (
          <div className="phrase-next-preview" data-testid="phrase-next-preview">
            下一個詞：<span>{upcoming.text}</span>
          </div>
        ) : null}

        {isMobile ? (
          <div
            className={"mobile-typed" + (typed ? "" : " is-empty")}
            style={{
              borderColor: bad ? theme.text.danger : undefined,
              background: bad ? theme.fill.dangerSoft : undefined,
            }}
            data-testid="phrase-typed-display"
          >
            {typed ? up(typed) : isTouch ? "點下面鍵盤輸入" : "直接打字輸入"}
          </div>
        ) : (
          <>
            <p style={{ ...theme.font.caption, color: theme.text.tertiary, margin: 0 }}>
              目前打「<strong>{activeChar.c}</strong>」，輸入字碼後按空白鍵或 Enter 連打下一字。
            </p>
            <input
              ref={inputRef}
              data-testid="phrase-input"
              value={typed}
              onChange={(e) => {
                const next = e.target.value;
                if (soundOn && next.length > typed.length) playKeySound();
                setTyped(next);
                if (bad) setBad(false);
              }}
              aria-label="詞彙連打字碼"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              lang="en"
              inputMode="text"
              maxLength={6}
              className={"code-input" + (bad ? " is-bad" : "")}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              <button type="button" className="ui-btn ui-btn-primary" onClick={() => submit(typed)}>
                送出<kbd className="ui-kbd">Space</kbd>
              </button>
              <button type="button" className="ui-btn" onClick={() => setHintOn(true)}>
                提示<kbd className="ui-kbd">/</kbd>
              </button>
              <button type="button" className="ui-btn" onClick={skipChar}>
                跳過此字<kbd className="ui-kbd">Esc</kbd>
              </button>
              <button type="button" className="ui-btn" data-testid="phrase-skip-btn" onClick={skipPhrase}>
                換下一詞
              </button>
            </div>
          </>
        )}

        {hintOn && !bad ? (
          <p style={{ ...theme.font.body1, color: theme.text.accent, margin: 0, fontWeight: theme.weight.semibold }}>
            「{activeChar.c}」第一碼是 {hintOf(activeChar.k)}
          </p>
        ) : null}

        {bad ? (
          <div style={{ textAlign: "center", maxWidth: 520 }} data-testid="phrase-bad-feedback">
            <p style={{ ...theme.font.body1, color: theme.text.danger, margin: "0 0 6px", fontWeight: theme.weight.semibold }}>
              「{activeChar.c}」字碼：{fmtCodes(activeChar.k)}
              {activeChar.a?.length ? "（選字：" + fmtCodes(activeChar.a) + "）" : ""}
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
  }

  if (isMobile) {
    const header = (
      <header className="mobile-header">
        <div className="mobile-header-text">
          <div className="mobile-brand-row">
            <BrandMark size={26} />
            <h1 style={{ fontWeight: theme.weight.semibold }}>無蝦米練功房</h1>
          </div>
          <div className="mobile-header-stats">
            詞彙連打 · 已完 {phrasesDone} 詞 · {accText}
          </div>
        </div>
        <IconGearButton theme={theme} onClick={props.onOpenSettings} />
      </header>
    );
    const footer =
      status === "ready" && activeChar ? (
        <OnScreenKeyboard
          theme={theme}
          reps={reps}
          showRoots={hintOn || bad}
          collapsible={!isTouch}
          disabled={false}
          submitLabel="送出"
          submitDisabled={typed.trim() === ""}
          hintDisabled={false}
          onLetter={(k) => {
            if (soundOn) playKeySound();
            setTyped((t) => (t + k).slice(0, 6));
            if (bad) setBad(false);
          }}
          onDelete={() => {
            setTyped((t) => t.slice(0, -1));
            if (bad) setBad(false);
          }}
          onHint={() => setHintOn(true)}
          onSkip={skipChar}
          onSubmit={() => submit(typed)}
        />
      ) : (
        <div className="os-actions">
          <button type="button" className="os-action is-primary" onClick={load} style={{ minHeight: 52 }}>
            重新載入
          </button>
        </div>
      );
    return (
      <MobileShell
        theme={theme}
        answer={activeChar?.k[0] ?? ""}
        header={header}
        modeStrip={props.mobileModeStrip}
        todayBar={props.mobileTodayBar}
        stage={stageContent}
        footer={footer}
        sheets={props.mobileSheets}
      />
    );
  }

  return (
    <section className="stage-card" data-testid="phrase-desktop">
      {stageContent}
    </section>
  );
}
