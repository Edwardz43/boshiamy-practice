import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { GrokTheme } from "./theme";
import { IconGearButton, MobileShell } from "./MobileChrome";
import { BrandMark } from "./ThemePicker";
import { loadTable, loadVariants } from "./tableLoader";
import { WordbookPractice } from "./WordbookPractice";
import {
  buildReverse,
  detectMode,
  lookupCode,
  lookupText,
  lookupTokens,
  parseCodes,
  variantsOf,
  type ReverseIndex,
  type Table,
  type Variants,
} from "./lookupLogic";

type Status = "loading" | "error" | "ready";

function up(s: string): string {
  return s.toUpperCase();
}

export default function LookupMode(props: {
  theme: GrokTheme;
  isMobile: boolean;
  reps: Record<string, string>;
  wordbook?: string[];
  autoNext?: boolean;
  soundOn?: boolean;
  sheetOpen?: boolean;
  startPracticeTick?: number;
  prefillQuery?: string;
  prefillTick?: number;
  onToggleWordbook?: (ch: string) => void;
  onAddWordbookMany?: (chars: string[]) => void;
  onRemoveWordbook?: (ch: string) => void;
  onClearWordbook?: () => void;
  onWordbookAttempt?: (info: { ch: string; correct: boolean; ms: number }) => void;
  onOpenSettings: () => void;
  mobileModeStrip?: ReactNode;
  mobileTodayBar?: ReactNode;
  mobileSheets?: ReactNode;
}): JSX.Element {
  const { theme, isMobile } = props;
  const wordbook = props.wordbook ?? [];
  const wordbookSet = useMemo(() => new Set(wordbook), [wordbook]);
  const [status, setStatus] = useState<Status>("loading");
  const [table, setTable] = useState<Table | null>(null);
  const [vars, setVars] = useState<Variants | null>(null);
  const [value, setValue] = useState<string>("");
  // What we actually look up; frozen while an IME is composing so half-typed pinyin/zhuyin isn't queried.
  const [query, setQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "ruby">("list");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [practicing, setPracticing] = useState<boolean>(false);
  const copyTimer = useRef<number | null>(null);
  const composing = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastPracticeTick = useRef<number>(props.startPracticeTick ?? 0);
  const lastPrefillTick = useRef<number>(0);

  useEffect(() => {
    const tick = props.startPracticeTick ?? 0;
    if (tick > lastPracticeTick.current && wordbook.length > 0) {
      lastPracticeTick.current = tick;
      setPracticing(true);
    }
  }, [props.startPracticeTick, wordbook.length]);

  useEffect(() => {
    const tick = props.prefillTick ?? 0;
    const text = (props.prefillQuery ?? "").trim();
    if (tick > lastPrefillTick.current && text) {
      lastPrefillTick.current = tick;
      setPracticing(false);
      setValue(text);
      setQuery(text);
    }
  }, [props.prefillTick, props.prefillQuery]);

  function copyCode(text: string, key: string): void {
    if (!text) return;
    const markCopied = (): void => {
      setCopiedKey(key);
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedKey(null), 1400);
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(markCopied).catch(markCopied);
    } else {
      markCopied();
    }
  }

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

  useEffect(() => {
    if (!isMobile && status === "ready") inputRef.current?.focus();
  }, [isMobile, status]);

  const reverse = useMemo<ReverseIndex | null>(() => (table ? buildReverse(table) : null), [table]);
  const kind = detectMode(query);

  const forward = useMemo(() => (table && kind === "forward" ? lookupText(table, query) : null), [table, kind, query]);
  const rubyRes = useMemo(
    () => (table && kind === "forward" && viewMode === "ruby" ? lookupTokens(table, query) : null),
    [table, kind, query, viewMode],
  );
  const codes = useMemo(() => (kind === "reverse" ? parseCodes(query) : []), [kind, query]);
  const reverseRes = useMemo(
    () => (reverse && kind === "reverse" ? codes.map((c) => lookupCode(reverse, c)) : []),
    [reverse, kind, codes],
  );

  const pill = (bg: string, fg: string): CSSProperties => ({
    display: "inline-block",
    fontSize: 11,
    lineHeight: 1.5,
    padding: "1px 8px",
    borderRadius: 999,
    background: bg,
    color: fg,
    fontWeight: theme.weight.semibold,
    whiteSpace: "nowrap",
  });
  const tagShort = pill(theme.fill.successSoft, theme.text.success);
  const tagPick = pill(theme.fill.secondary, theme.text.secondary);

  const input = (
    <textarea
      ref={inputRef}
      data-testid="lookup-input"
      className="code-textarea"
      value={value}
      rows={isMobile ? 3 : 4}
      placeholder="輸入或貼上中文字，例如：嘸蝦米　　　也可以輸入英文字碼反查，例如：ab"
      aria-label="查碼輸入"
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => {
        setValue(e.target.value);
        if (!composing.current) setQuery(e.target.value);
      }}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        setQuery(e.currentTarget.value);
      }}
      onKeyDown={(e) => {
        // Keep typing here away from the practice modes' global key handler; Alt+1~7 still switches mode.
        if (!e.altKey) e.nativeEvent.stopPropagation();
      }}
      style={{
        minHeight: isMobile ? 76 : 96,
        maxHeight: isMobile ? 160 : 260,
      }}
    />
  );

  const codeChip = (code: string, shortest: boolean, pick: boolean, key: string): JSX.Element => (
    <span key={key} className="lookup-code" data-code={code}>
      <span className="lookup-code-text" style={{ color: theme.text.primary }}>
        {up(code)}
      </span>
      {shortest ? <span style={tagShort}>最短碼</span> : null}
      {pick ? <span style={tagPick}>要選字</span> : null}
    </span>
  );

  const missColor = theme.text.danger;
  const variantBlock = (ch: string): JSX.Element | null => {
    if (!table) return null;
    const groups = variantsOf(table, vars, ch);
    if (!groups.length) return null;
    return (
      <span className="lookup-variants" data-testid="lookup-variants" style={{ borderColor: theme.border.subtle }}>
        {groups.map((g) => (
          <span key={g.kind} className="lookup-vgroup" data-kind={g.kind}>
            <span style={{ ...tagPick, flex: "0 0 auto" }}>{g.kind === "simp" ? "簡體" : "繁體"}</span>
            {g.items.map((it) => (
              <span key={it.c} className="lookup-variant" data-char={it.c}>
                <span className="lookup-vglyph">{it.c}</span>
                {it.found ? (
                  it.codes.map((x, i) => (
                    <span key={i} className="lookup-vcode" style={{ color: theme.text.primary }}>
                      {up(x.code)}
                      {x.pick ? <span style={{ color: theme.text.tertiary }}>（選字）</span> : null}
                    </span>
                  ))
                ) : (
                  <span style={{ color: missColor, fontSize: 13 }}>查無</span>
                )}
              </span>
            ))}
          </span>
        ))}
      </span>
    );
  };

  let body: JSX.Element | null = null;
  if (status === "loading") {
    body = (
      <p className="lookup-note" style={{ color: theme.text.secondary }}>
        載入碼表中…
      </p>
    );
  } else if (status === "error") {
    body = (
      <div className="lookup-note" style={{ color: theme.text.secondary }}>
        <p style={{ margin: "0 0 8px" }}>碼表載入失敗，請檢查網路後再試一次。</p>
        <button type="button" className="os-action is-primary" onClick={load} style={{ minHeight: 44, padding: "0 18px" }}>
          重試
        </button>
      </div>
    );
  } else if (kind === "empty") {
    body = (
      <p className="lookup-note" style={{ color: theme.text.tertiary }}>
        {query.trim() ? "沒有可查的字或字碼。標點和空白會自動略過。" : "貼上一段中文，會逐字列出嘸蝦米字碼；輸入英文字碼（如 ab）則反查是哪些字。"}
      </p>
    );
  } else if (forward) {
    const found = forward.results.filter((r) => r.found).length;
    const bestCodeFor = (r: (typeof forward.results)[number]): string => {
      if (!r.found || r.codes.length === 0) return "";
      const shortest = r.codes.find((x) => x.shortest);
      return up((shortest ?? r.codes[0]).code);
    };
    const allCodesStr = forward.results
      .filter((r) => r.found && r.codes.length > 0)
      .map((r) => r.c + ":" + bestCodeFor(r))
      .join(" ");
    body = (
      <>
        <div className="lookup-toolbar">
          <p className="lookup-summary" style={{ color: theme.text.secondary, margin: 0 }} data-testid="lookup-summary">
            共 {forward.total} 個字（重複的只列一次）
            {forward.total - found > 0 ? "，其中 " + (forward.total - found) + " 個查無" : ""}
            {forward.truncated ? "。只顯示前 400 個" : ""}
          </p>
          <div className="lookup-view-controls">
            <div className="lookup-view-seg" role="group" aria-label="顯示方式">
              <button
                type="button"
                data-testid="lookup-view-list"
                aria-pressed={viewMode === "list"}
                className={"ui-pill" + (viewMode === "list" ? " is-on" : "")}
                onClick={() => setViewMode("list")}
              >
                清單
              </button>
              <button
                type="button"
                data-testid="lookup-view-ruby"
                aria-pressed={viewMode === "ruby"}
                className={"ui-pill" + (viewMode === "ruby" ? " is-on" : "")}
                onClick={() => setViewMode("ruby")}
              >
                Ruby 標註
              </button>
            </div>
            {found > 1 && props.onAddWordbookMany ? (() => {
              const foundChars = forward.results.filter((r) => r.found).map((r) => r.c);
              const unsaved = foundChars.filter((c) => !wordbookSet.has(c));
              return (
                <button
                  type="button"
                  className="lookup-copy-btn"
                  data-testid="lookup-star-all"
                  disabled={unsaved.length === 0}
                  onClick={() => props.onAddWordbookMany?.(unsaved)}
                >
                  {unsaved.length === 0 ? "★ 皆已收藏" : `☆ 全部加入生字本 (+${unsaved.length})`}
                </button>
              );
            })() : null}
            {found > 0 ? (
              <button
                type="button"
                className="lookup-copy-btn"
                data-testid="lookup-copy-all"
                onClick={() => copyCode(allCodesStr, "__all__")}
              >
                {copiedKey === "__all__" ? "已複製全部 ✓" : "複製全部字碼"}
              </button>
            ) : null}
          </div>
        </div>
        {viewMode === "ruby" && rubyRes ? (
          <div className="lookup-ruby-box" data-testid="lookup-ruby">
            {rubyRes.tokens.map((tk, i) => {
              if (tk.isBreak) return <br key={"br-" + i} />;
              if (!tk.isCjk) {
                return (
                  <span key={"txt-" + i} className="lookup-ruby-plain">
                    {tk.c}
                  </span>
                );
              }
              if (!tk.found || !tk.code) {
                return (
                  <ruby key={"miss-" + i} className="lookup-ruby-item is-missing" data-char={tk.c}>
                    {tk.c}
                    <rp>(</rp>
                    <rt>?</rt>
                    <rp>)</rp>
                  </ruby>
                );
              }
              const upper = up(tk.code);
              const k = "ruby-" + i;
              return (
                <button
                  key={k}
                  type="button"
                  className={"lookup-ruby-btn" + (tk.pick ? " is-pick" : "") + (copiedKey === k ? " is-copied" : "")}
                  title={tk.pick ? upper + "（要選字），點一下複製" : upper + "，點一下複製"}
                  onClick={() => copyCode(upper, k)}
                >
                  <ruby className="lookup-ruby-item" data-char={tk.c}>
                    {tk.c}
                    <rp>(</rp>
                    <rt>{copiedKey === k ? "✓" : upper}</rt>
                    <rp>)</rp>
                  </ruby>
                </button>
              );
            })}
            <p className="lookup-ruby-hint" style={{ color: theme.text.tertiary }}>
              點任意中文字可複製最短字碼；虛線底字表示需選字。
            </p>
          </div>
        ) : (
          <ul className="lookup-list" data-testid="lookup-results">
            {forward.results.map((r) => {
              const primaryCode = bestCodeFor(r);
              const cKey = "row-" + r.c;
              return (
                <li key={r.c} className="lookup-row" data-char={r.c}>
                  <span className="lookup-glyph">{r.c}</span>
                  {r.found ? (
                    <span className="lookup-codes">
                      {r.codes.map((x, i) => codeChip(x.code, x.shortest, x.pick, r.c + i))}
                      <button
                        type="button"
                        className="lookup-copy-btn"
                        data-testid="lookup-copy-btn"
                        aria-label={"複製「" + r.c + "」字碼 " + primaryCode}
                        onClick={() => copyCode(primaryCode, cKey)}
                      >
                        {copiedKey === cKey ? "已複製 ✓" : "複製"}
                      </button>
                      {props.onToggleWordbook ? (() => {
                        const starred = wordbookSet.has(r.c);
                        return (
                          <button
                            type="button"
                            className={"lookup-star-btn" + (starred ? " is-starred" : "")}
                            data-testid="lookup-star-btn"
                            data-char={r.c}
                            aria-pressed={starred}
                            aria-label={(starred ? "移出生字本：" : "加入生字本：") + r.c}
                            onClick={() => props.onToggleWordbook?.(r.c)}
                          >
                            {starred ? "★ 已收藏" : "☆ 生字本"}
                          </button>
                        );
                      })() : null}
                      <span className="lookup-roots" style={{ color: theme.text.tertiary }}>
                        {r.codes[0].code
                          .split("")
                          .map((ch) => up(ch) + (props.reps[ch] ? " " + props.reps[ch] : ""))
                          .join("　")}
                      </span>
                      {variantBlock(r.c)}
                    </span>
                  ) : (
                    <span className="lookup-codes">
                      <span className="lookup-missing" style={{ color: theme.text.danger }}>
                        查無
                      </span>
                      {variantBlock(r.c)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  } else {
    body = (
      <ul className="lookup-list" data-testid="lookup-results">
        {reverseRes.map((r) => (
          <li key={r.code} className="lookup-row is-reverse" data-code={r.code}>
            <span className="lookup-glyph lookup-glyph-code">{up(r.code)}</span>
            {r.chars.length ? (
              <span className="lookup-chars">
                {r.chars.map((x, i) => (
                  <button
                    key={x.c + i}
                    type="button"
                    className="lookup-char-btn"
                    title={x.pick ? "要選字" : undefined}
                    onClick={() => {
                      setValue(x.c);
                      setQuery(x.c);
                    }}
                    style={{
                      borderColor: theme.border.default,
                      color: theme.text.primary,
                      background: x.pick ? theme.fill.secondary : "transparent",
                    }}
                  >
                    {x.c}
                  </button>
                ))}
                <span className="lookup-roots" style={{ color: theme.text.tertiary, flexBasis: "100%" }}>
                  共 {r.chars.length} 個字
                  {r.chars.some((x) => x.pick) ? "；灰底的字要選字" : ""}。點一個字可查它的字碼。
                </span>
              </span>
            ) : (
              <span className="lookup-missing" style={{ color: theme.text.tertiary }}>
                這個碼沒有對應的字
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  const wordbookPanel =
    props.onToggleWordbook ? (
      <div className="wordbook-panel" data-testid="wordbook-panel">
        <div className="wordbook-panel-head">
          <div className="wordbook-panel-title">
            <span aria-hidden="true">★</span>
            <span>我的生字本</span>
            <span className="wordbook-count" data-testid="wordbook-count">
              {wordbook.length} 字
            </span>
          </div>
          <div className="wordbook-panel-actions">
            {wordbook.length > 0 ? (
              <>
                <button
                  type="button"
                  className="ui-btn ui-btn-primary wordbook-go-btn"
                  data-testid="wordbook-practice-btn"
                  disabled={!table}
                  onClick={() => setPracticing(true)}
                >
                  開始複習生字本
                </button>
                {props.onClearWordbook ? (
                  <button
                    type="button"
                    className="ui-btn ui-btn-ghost"
                    data-testid="wordbook-clear-btn"
                    style={{ minHeight: 32, padding: "4px 10px", fontSize: 12 }}
                    onClick={() => {
                      if (window.confirm("確定要清空生字本嗎？")) props.onClearWordbook?.();
                    }}
                  >
                    清空
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        {wordbook.length === 0 ? (
          <p className="wordbook-empty" style={{ color: theme.text.tertiary, margin: 0 }}>
            查完不熟的字後按「☆ 生字本」就能收進來，隨時開一輪專屬複習。
          </p>
        ) : (
          <div className="wordbook-chips" data-testid="wordbook-chips">
            {wordbook.map((ch) => (
              <span key={ch} className="wordbook-chip" data-char={ch}>
                <button
                  type="button"
                  className="wordbook-chip-char"
                  title={"查看「" + ch + "」字碼"}
                  onClick={() => {
                    setValue(ch);
                    setQuery(ch);
                  }}
                >
                  {ch}
                </button>
                {props.onRemoveWordbook ? (
                  <button
                    type="button"
                    className="wordbook-chip-del"
                    aria-label={"移出生字本：" + ch}
                    onClick={() => props.onRemoveWordbook?.(ch)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        )}
      </div>
    ) : null;

  if (practicing && table) {
    return (
      <WordbookPractice
        theme={theme}
        isMobile={isMobile}
        reps={props.reps}
        table={table}
        vars={vars}
        wordbook={wordbook}
        autoNext={props.autoNext ?? false}
        soundOn={props.soundOn ?? false}
        sheetOpen={props.sheetOpen}
        onAttempt={props.onWordbookAttempt}
        onRemoveWordbook={(ch) => props.onRemoveWordbook?.(ch)}
        onBack={() => setPracticing(false)}
        onOpenSettings={props.onOpenSettings}
        mobileModeStrip={props.mobileModeStrip}
        mobileTodayBar={props.mobileTodayBar}
        mobileSheets={props.mobileSheets}
      />
    );
  }

  const help = "輸入中文字：逐字列出字碼，標出最短碼。輸入英文字碼：反查對應的字。";

  if (isMobile) {
    const header = (
      <header className="mobile-header">
        <div className="mobile-header-text">
          <div className="mobile-brand-row">
            <BrandMark size={26} />
            <h1 style={{ fontWeight: theme.weight.semibold }}>無蝦米練功房</h1>
          </div>
          <div className="mobile-header-stats">
            查碼{wordbook.length > 0 ? ` · 生字本 ${wordbook.length} 字` : ""}
          </div>
        </div>
        <IconGearButton theme={theme} onClick={props.onOpenSettings} />
      </header>
    );
    const stage = (
      <div className="lookup-wrap" data-testid="lookup-mobile">
        {input}
        {body}
        {wordbookPanel}
      </div>
    );
    const footer = (
      <div className="os-actions">
        <button
          type="button"
          className="os-action"
          onClick={() => {
            setValue("");
            setQuery("");
            inputRef.current?.focus();
          }}
          disabled={!value}
          style={{ minHeight: 52 }}
        >
          清除
        </button>
        <button
          type="button"
          className="os-action is-primary"
          onClick={() => {
            const t = navigator.clipboard?.readText?.();
            if (!t) {
              inputRef.current?.focus();
              return;
            }
            t.then((s) => {
              setValue(s);
              setQuery(s);
            }).catch(() => inputRef.current?.focus());
          }}
          style={{ minHeight: 52 }}
        >
          貼上
        </button>
      </div>
    );
    return (
      <MobileShell
        theme={theme}
        header={header}
        modeStrip={props.mobileModeStrip}
        todayBar={props.mobileTodayBar}
        stage={stage}
        footer={footer}
        sheets={props.mobileSheets}
      />
    );
  }

  return (
    <section
      data-testid="lookup-desktop"
      className="stage-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="stage-meta" style={{ alignSelf: "flex-start" }}>查碼工具</div>
      {input}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className="ui-btn"
          style={{ minHeight: 38 }}
          onClick={() => {
            setValue("");
            setQuery("");
            inputRef.current?.focus();
          }}
          disabled={!value}
        >
          清除
        </button>
        <span style={{ ...theme.font.caption, color: theme.text.tertiary }}>{help}</span>
      </div>
      {body}
      {wordbookPanel}
      <p style={{ ...theme.font.caption, color: theme.text.tertiary, margin: 0 }}>
        字碼資料來自內建碼表，離線也能查。繁簡對照取自 OpenCC（Apache-2.0 授權）。「最短碼」是同一個字的多組碼裡最短的；「要選字」表示要從候選字裡再選。
      </p>
    </section>
  );
}
