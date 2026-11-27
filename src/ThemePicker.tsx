import { useEffect, useRef, type JSX } from "react";
import { THEME_LIST, useThemeControl, type ColorMode } from "./theme";

export type NavMode = "roots" | "chars" | "short" | "phrases" | "timed" | "article" | "lookup" | "history";

export function BrandMark(props: { size?: number }): JSX.Element {
  const size = props.size ?? 34;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className="brand-mark-svg"
    >
      <rect x="1" y="1" width="34" height="34" rx="9" fill="var(--brand-primary)" />
      <rect
        x="3.5"
        y="3.5"
        width="29"
        height="29"
        rx="6.5"
        stroke="var(--brand-primary-text)"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      <text
        x="18"
        y="19"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--brand-primary-text)"
        fontSize="19"
        fontWeight="700"
        fontFamily="var(--font-sans)"
      >
        蝦
      </text>
    </svg>
  );
}

export function ModeIcon(props: { mode: NavMode }): JSX.Element {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (props.mode) {
    case "roots":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="7.5" height="7.5" rx="1.8" />
          <rect x="13.5" y="4" width="7.5" height="7.5" rx="1.8" />
          <rect x="3" y="14.5" width="7.5" height="6" rx="1.8" />
          <rect x="13.5" y="14.5" width="7.5" height="6" rx="1.8" />
        </svg>
      );
    case "chars":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8.5 9.5h7M12 7.5v9M9 14.5h6" />
        </svg>
      );
    case "short":
      return (
        <svg {...common}>
          <path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12L13 2z" />
        </svg>
      );
    case "phrases":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="8" height="14" rx="2" />
          <rect x="13" y="5" width="8" height="14" rx="2" />
          <path d="M6 10h2M6 14h2M16 10h2M16 14h2" />
        </svg>
      );
    case "timed":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M9.5 3h5" />
        </svg>
      );
    case "article":
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22V5.5z" />
          <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5a2.5 2.5 0 0 1 2.5 2V5.5z" />
        </svg>
      );
    case "lookup":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <path d="M4 19h16" />
          <path d="M7 16v-5M12 16V7M17 16v-8" />
        </svg>
      );
  }
}

function SunIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.2 14.5A8.5 8.5 0 0 1 9.5 3.8a8.5 8.5 0 1 0 10.7 10.7z" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: "system", label: "跟隨系統" },
  { value: "light", label: "淺色" },
  { value: "dark", label: "深色" },
];

function SwatchDots(props: { colors: [string, string, string, string] }): JSX.Element {
  return (
    <span className="swatch-dots" aria-hidden="true">
      <span className="swatch-dot" style={{ background: props.colors[0] }} />
      <span className="swatch-dot" style={{ background: props.colors[2] }} />
      <span className="swatch-dot" style={{ background: props.colors[3] }} />
    </span>
  );
}

export function DesktopThemeBar(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const { themeId, colorMode, theme, setThemeId, setColorMode, setPreview, clearPreview } = useThemeControl();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentMeta = THEME_LIST.find((t) => t.id === themeId) ?? THEME_LIST[0];

  useEffect(() => {
    if (!props.open) {
      clearPreview();
      return;
    }
    const onPointerDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        clearPreview();
        props.onOpenChange(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [props.open, props.onOpenChange, clearPreview]);

  const toggleLightDark = (): void => {
    setColorMode(theme.kind === "dark" ? "light" : "dark");
  };

  return (
    <div className="theme-bar" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        data-testid="color-mode-btn"
        onClick={toggleLightDark}
        aria-label={theme.kind === "dark" ? "切換成淺色模式" : "切換成深色模式"}
        title={theme.kind === "dark" ? "切換成淺色模式" : "切換成深色模式"}
      >
        {theme.kind === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>

      <button
        type="button"
        className={"theme-picker-btn" + (props.open ? " is-open" : "")}
        data-testid="theme-picker-btn"
        aria-expanded={props.open}
        aria-haspopup="dialog"
        aria-label="切換外觀主題"
        onClick={() => {
          if (props.open) clearPreview();
          props.onOpenChange(!props.open);
        }}
      >
        <SwatchDots colors={currentMeta.swatches[theme.kind]} />
        <span className="theme-picker-name">{currentMeta.name}</span>
        <kbd className="kbd">⌥P</kbd>
      </button>

      {props.open ? (
        <div
          className="theme-popover"
          data-testid="theme-popover"
          role="dialog"
          aria-label="選擇外觀主題"
          onMouseLeave={clearPreview}
        >
          <div className="theme-popover-head">
            <span className="theme-popover-title">明暗模式</span>
            {colorMode === "system" ? (
              <span className="theme-popover-hint">
                目前跟隨系統（{theme.kind === "dark" ? "深色" : "淺色"}）
              </span>
            ) : null}
          </div>
          <div className="color-mode-seg" role="group" aria-label="明暗模式">
            {COLOR_MODES.map((m) => {
              const on = colorMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  data-testid={"color-mode-" + m.value}
                  aria-pressed={on}
                  className={"color-mode-chip" + (on ? " is-on" : "")}
                  onClick={() => setColorMode(m.value)}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="theme-popover-head" style={{ marginTop: 12 }}>
            <span className="theme-popover-title">主題風格</span>
            <span className="theme-popover-hint">游標移入可即時預覽</span>
          </div>
          <div className="theme-grid" onMouseLeave={clearPreview}>
            {THEME_LIST.map((meta) => {
              const on = themeId === meta.id;
              const sw = meta.swatches[theme.kind];
              return (
                <button
                  key={meta.id}
                  type="button"
                  data-testid={"theme-option-" + meta.id}
                  aria-pressed={on}
                  className={"theme-swatch-card" + (on ? " is-on" : "")}
                  onMouseEnter={() => setPreview(meta.id)}
                  onFocus={() => setPreview(meta.id)}
                  onBlur={() => clearPreview()}
                  onClick={() => {
                    setThemeId(meta.id);
                    clearPreview();
                    props.onOpenChange(false);
                  }}
                >
                  <div className="theme-swatch-preview" style={{ background: sw[0], borderColor: "rgba(128,128,128,0.22)" }}>
                    <span className="theme-swatch-surface" style={{ background: sw[1] }}>
                      <span className="theme-swatch-accent" style={{ background: sw[2] }} />
                      <span className="theme-swatch-seal" style={{ background: sw[3] }} />
                    </span>
                  </div>
                  <div className="theme-swatch-info">
                    <div className="theme-swatch-title-row">
                      <span className="theme-swatch-name">{meta.name}</span>
                      {on ? (
                        <span className="theme-swatch-check">
                          <CheckIcon />
                        </span>
                      ) : null}
                    </div>
                    <div className="theme-swatch-desc">{meta.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MobileThemeSection(): JSX.Element {
  const { themeId, colorMode, theme, setThemeId, setColorMode } = useThemeControl();
  return (
    <div className="settings-block" data-testid="mobile-theme-section">
      <p className="settings-label">外觀主題</p>
      <div className="color-mode-seg" role="group" aria-label="明暗模式">
        {COLOR_MODES.map((m) => {
          const on = colorMode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              data-testid={"color-mode-" + m.value}
              aria-pressed={on}
              className={"color-mode-chip" + (on ? " is-on" : "")}
              onClick={() => setColorMode(m.value)}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div className="mobile-theme-grid">
        {THEME_LIST.map((meta) => {
          const on = themeId === meta.id;
          const sw = meta.swatches[theme.kind];
          return (
            <button
              key={meta.id}
              type="button"
              data-testid={"theme-option-" + meta.id}
              aria-pressed={on}
              className={"theme-swatch-card is-compact" + (on ? " is-on" : "")}
              onClick={() => setThemeId(meta.id)}
            >
              <div className="theme-swatch-title-row">
                <SwatchDots colors={sw} />
                <span className="theme-swatch-name">{meta.name}</span>
                {on ? (
                  <span className="theme-swatch-check">
                    <CheckIcon />
                  </span>
                ) : null}
              </div>
              <div className="theme-swatch-desc">{meta.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
