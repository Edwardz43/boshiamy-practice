import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { GrokTheme } from "./theme";
import { IconGearButton, MobileShell } from "./MobileChrome";
import { BrandMark } from "./ThemePicker";
import {
  buildReverse,
  detectMode,
  lookupCode,
  lookupText,
  parseCodes,
  variantsOf,
  type ReverseIndex,
  type Table,
  type Variants,
} from "./lookupLogic";

type Status = "loading" | "error" | "ready";

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
// 繁簡對照 is a nice-to-have: if it fails to load, 查碼 still works without it.
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

function up(s: string): string {
  return s.toUpperCase();
}

export default function LookupMode(props: {
  theme: GrokTheme;
  isMobile: boolean;
  reps: Record<string, string>;
  onOpenSettings: () => void;
  mobileSheets?: ReactNode;
}): JSX.Element {
  const { theme, isMobile } = props;
  const [status, setStatus] = useState<Status>("loading");
  const [table, setTable] = useState<Table | null>(null);
  const [vars, setVars] = useState<Variants | null>(null);
  const [value, setValue] = useState<string>("");
  // What we actually look up; frozen while an IME is composing so half-typed pinyin/zhuyin isn't queried.
  const [query, setQuery] = useState<string>("");
  const composing = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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
    body = (
      <>
        <p className="lookup-summary" style={{ color: theme.text.secondary }} data-testid="lookup-summary">
          共 {forward.total} 個字（重複的只列一次）
          {forward.total - found > 0 ? "，其中 " + (forward.total - found) + " 個查無" : ""}
          {forward.truncated ? "。只顯示前 400 個" : ""}
        </p>
        <ul className="lookup-list" data-testid="lookup-results">
          {forward.results.map((r) => (
            <li key={r.c} className="lookup-row" data-char={r.c}>
              <span className="lookup-glyph">{r.c}</span>
              {r.found ? (
                <span className="lookup-codes">
                  {r.codes.map((x, i) => codeChip(x.code, x.shortest, x.pick, r.c + i))}
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
          ))}
        </ul>
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
            查碼
          </div>
        </div>
        <IconGearButton theme={theme} onClick={props.onOpenSettings} />
      </header>
    );
    const stage = (
      <div className="lookup-wrap" data-testid="lookup-mobile">
        {input}
        {body}
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
    return <MobileShell theme={theme} header={header} stage={stage} footer={footer} sheets={props.mobileSheets} />;
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
      <p style={{ ...theme.font.caption, color: theme.text.tertiary, margin: 0 }}>
        字碼資料來自內建碼表，離線也能查。繁簡對照取自 OpenCC（Apache-2.0 授權）。「最短碼」是同一個字的多組碼裡最短的；「要選字」表示要從候選字裡再選。
      </p>
    </section>
  );
}
