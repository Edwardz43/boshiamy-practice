import { useCallback, useRef, useState, type JSX, type PointerEvent } from "react";
import type { GrokTheme } from "./theme";

const ROWS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

function up(code: string): string {
  return code.toUpperCase();
}

function vibrate(): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
    }
  } catch {
    /* some browsers throw if vibration is blocked */
  }
}

type KeyProps = {
  letter: string;
  roots?: string;
  showRoots: boolean;
  disabled?: boolean;
  onPress: (letter: string) => void;
};

function LetterKey(props: KeyProps): JSX.Element {
  const [pressed, setPressed] = useState(false);
  const armed = useRef(false);

  const release = useCallback(
    (commit: boolean) => {
      if (!armed.current) return;
      armed.current = false;
      setPressed(false);
      if (commit && !props.disabled) props.onPress(props.letter);
    },
    [props],
  );

  function onPointerDown(e: PointerEvent<HTMLButtonElement>): void {
    if (props.disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    armed.current = true;
    setPressed(true);
    vibrate();
  }

  function onPointerUp(e: PointerEvent<HTMLButtonElement>): void {
    const rect = e.currentTarget.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    release(inside);
  }

  return (
    <button
      type="button"
      className={"os-key" + (pressed ? " is-pressed" : "") + (props.showRoots ? " has-roots" : "")}
      disabled={props.disabled}
      aria-label={props.letter}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => release(false)}
    >
      {pressed ? (
        <span className="os-key-pop" aria-hidden="true">
          <span className="os-key-pop-letter">{up(props.letter)}</span>
          {props.showRoots && props.roots ? (
            <span className="os-key-pop-roots">{props.roots}</span>
          ) : null}
        </span>
      ) : null}
      <span className="os-key-letter">{up(props.letter)}</span>
      {props.showRoots && props.roots ? <span className="os-key-roots">{props.roots}</span> : null}
    </button>
  );
}

export function OnScreenKeyboard(props: {
  theme: GrokTheme;
  reps: Record<string, string>;
  showRoots: boolean;
  disabled?: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  hintDisabled?: boolean;
  onLetter: (letter: string) => void;
  onDelete: () => void;
  onHint: () => void;
  onSkip: () => void;
  onSubmit: () => void;
}): JSX.Element {
  void props.theme;
  return (
    <div className="os-kb" role="group" aria-label="字根鍵盤">
      {ROWS.map((row, i) => (
        <div key={i} className={"os-row os-row-" + i}>
          {row.map((k) => (
            <LetterKey
              key={k}
              letter={k}
              roots={(props.reps[k] ?? "").replace(/\s+/g, "")}
              showRoots={props.showRoots}
              disabled={props.disabled}
              onPress={props.onLetter}
            />
          ))}
        </div>
      ))}
      <div className="os-actions">
        <ActionKey label="刪除" onPress={props.onDelete} disabled={props.disabled} />
        <ActionKey label="提示" onPress={props.onHint} disabled={props.hintDisabled} />
        <ActionKey label="跳過" onPress={props.onSkip} />
        <ActionKey
          label={props.submitLabel}
          onPress={props.onSubmit}
          disabled={props.submitDisabled}
          primary
        />
      </div>
    </div>
  );
}

function ActionKey(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}): JSX.Element {
  function onPointerDown(e: PointerEvent<HTMLButtonElement>): void {
    if (props.disabled) return;
    e.preventDefault();
    vibrate();
  }
  return (
    <button
      type="button"
      className={"os-action" + (props.primary ? " is-primary" : "")}
      disabled={props.disabled}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (!props.disabled) props.onPress();
      }}
    >
      {props.label}
    </button>
  );
}
