import { Fragment, useRef, useState, type CSSProperties, type JSX, type ReactNode, type TouchEvent } from "react";
import type { GrokTheme } from "./theme";
import { ModeIcon, type NavMode } from "./ThemePicker";

export const MOBILE_MODES: { value: NavMode; label: string; shortLabel: string; group: "practice" | "tools" }[] = [
  { value: "roots", label: "字根練習", shortLabel: "字根", group: "practice" },
  { value: "short", label: "簡碼練習", shortLabel: "簡碼", group: "practice" },
  { value: "chars", label: "常用字", shortLabel: "常用字", group: "practice" },
  { value: "phrases", label: "詞彙連打", shortLabel: "詞彙", group: "practice" },
  { value: "article", label: "文章練習", shortLabel: "文章", group: "practice" },
  { value: "timed", label: "限時挑戰", shortLabel: "限時", group: "practice" },
  { value: "lookup", label: "查碼", shortLabel: "查碼", group: "tools" },
  { value: "history", label: "紀錄", shortLabel: "紀錄", group: "tools" },
];

export function MobileModeStrip(props: {
  mode: NavMode;
  onChange: (mode: NavMode) => void;
}): JSX.Element {
  return (
    <nav className="mobile-mode-strip" aria-label="快速切換模式" data-testid="mobile-mode-strip">
      {MOBILE_MODES.map((m, idx) => {
        const on = props.mode === m.value;
        const prev = idx > 0 ? MOBILE_MODES[idx - 1] : null;
        const showDivider = prev != null && prev.group !== m.group;
        return (
          <Fragment key={m.value}>
            {showDivider ? <span className="mobile-mode-divider" aria-hidden="true" /> : null}
            <button
              type="button"
              data-testid={"mobile-mode-chip-" + m.value}
              aria-current={on ? "page" : undefined}
              className={"mobile-mode-chip" + (on ? " is-on" : "")}
              onClick={() => props.onChange(m.value)}
            >
              <ModeIcon mode={m.value} />
              <span>{m.shortLabel}</span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

export function MobileTodayBar(props: {
  tried: number;
  goal: number;
  pct: number;
  done: boolean;
  streakDays: number;
  weakCount: number;
  reviewOn: boolean;
  onWeakReview: () => void;
}): JSX.Element {
  return (
    <div className="mobile-today-bar" data-testid="mobile-today-bar">
      <div className="mobile-today-progress">
        <span className="mobile-today-text">
          今日 {props.tried}/{props.goal}
          {props.done ? " ✓" : ""}
        </span>
        <span className="mobile-today-track" aria-hidden="true">
          <span
            className={"mobile-today-fill" + (props.done ? " is-done" : "")}
            style={{ width: props.pct + "%" }}
          />
        </span>
        <span className="mobile-today-streak">
          {props.streakDays > 0 ? "🔥 " + props.streakDays + "天" : "首日"}
        </span>
      </div>
      {props.weakCount > 0 && !props.reviewOn ? (
        <button
          type="button"
          className="mobile-today-cta"
          data-testid="mobile-weak-cta"
          onClick={props.onWeakReview}
        >
          複習弱點 ({props.weakCount})
        </button>
      ) : null}
    </div>
  );
}

export function MobileShell(props: {
  theme: GrokTheme;
  answer?: string;
  header: ReactNode;
  modeStrip?: ReactNode;
  todayBar?: ReactNode;
  stage: ReactNode;
  footer: ReactNode;
  sheets?: ReactNode;
}): JSX.Element {
  const style: CSSProperties = {
    background: props.theme.bg.base,
    color: props.theme.text.primary,
    fontFamily: props.theme.font.family,
  };
  return (
    <div className="mobile-shell" style={style} data-testid="mobile-root" data-answer={props.answer ?? ""}>
      {props.header}
      {props.modeStrip}
      {props.todayBar}
      <main className="mobile-stage">{props.stage}</main>
      <footer className="mobile-footer">{props.footer}</footer>
      {props.sheets}
    </div>
  );
}

export function BottomSheet(props: {
  theme: GrokTheme;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}): JSX.Element {
  const startY = useRef(0);
  const dragging = useRef(false);
  const [dy, setDy] = useState(0);

  function onTouchStart(e: TouchEvent<HTMLDivElement>): void {
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  }
  function onTouchMove(e: TouchEvent<HTMLDivElement>): void {
    if (!dragging.current) return;
    const d = e.touches[0].clientY - startY.current;
    setDy(d > 0 ? d : 0);
  }
  function onTouchEnd(): void {
    dragging.current = false;
    if (dy > 80) props.onClose();
    setDy(0);
  }

  return (
    <div className="sheet-root" data-testid={props.testId} role="dialog" aria-modal="true" aria-label={props.title}>
      <button type="button" className="sheet-backdrop" aria-label="關閉面板" onClick={props.onClose} />
      <div
        className="sheet-panel"
        style={{
          background: props.theme.bg.elevated,
          color: props.theme.text.primary,
          borderColor: props.theme.border.default,
          transform: dy ? "translateY(" + dy + "px)" : undefined,
          transition: dy ? "none" : "transform 0.28s ease",
        }}
      >
        <div
          className="sheet-handle-wrap"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="sheet-handle" style={{ background: props.theme.border.strong }} />
          <div className="sheet-title-row">
            <h2 style={{ ...props.theme.font.heading3, margin: 0, fontWeight: props.theme.weight.semibold }}>
              {props.title}
            </h2>
            <button
              type="button"
              className="sheet-close"
              onClick={props.onClose}
              aria-label="關閉"
              style={{ color: props.theme.text.secondary }}
            >
              關閉
            </button>
          </div>
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

export function IconGearButton(props: {
  theme: GrokTheme;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="gear-btn"
      onClick={props.onClick}
      aria-label="設定"
      style={{
        color: props.theme.text.primary,
        borderColor: props.theme.border.default,
        background: props.theme.bg.elevated,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19.4 13.5a7.7 7.7 0 0 0 .1-3l2-1.2-2-3.4-2.3.5a7.6 7.6 0 0 0-2.6-1.5L14 3h-4l-.6 2.4a7.6 7.6 0 0 0-2.6 1.5l-2.3-.5-2 3.4 2 1.2a7.7 7.7 0 0 0 .1 3l-2 1.2 2 3.4 2.3-.5a7.6 7.6 0 0 0 2.6 1.5L10 21h4l.6-2.4a7.6 7.6 0 0 0 2.6-1.5l2.3.5 2-3.4-2-1.2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function ToggleRow(props: {
  theme: GrokTheme;
  label: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="toggle-row"
      onClick={props.onToggle}
      disabled={props.disabled}
      aria-pressed={props.on}
      style={{ opacity: props.disabled ? 0.5 : 1 }}
    >
      <span style={{ ...props.theme.font.body1, fontWeight: props.theme.weight.medium }}>{props.label}</span>
      <span className={"toggle-track" + (props.on ? " is-on" : "")} aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}
