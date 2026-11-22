import type { JSX } from "react";
import { formatCodeRoots, type SimpHint } from "./simplifiedLogic";

export function SimpHintBar(props: {
  hints: SimpHint[];
  reps: Record<string, string>;
  shownCodes?: string[];
  compact?: boolean;
}): JSX.Element | null {
  if (props.hints.length === 0) return null;
  const shown = new Set((props.shownCodes ?? []).map((x) => x.toLowerCase()));

  return (
    <div className={"simp-hint-box" + (props.compact ? " is-compact" : "")} data-testid="simp-hint">
      <span className="simp-hint-badge">簡體拆碼</span>
      <div className="simp-hint-list">
        {props.hints.map((h) => {
          const primary = h.directCodes[0] ?? h.selectCodes[0] ?? "";
          const showRoots = primary !== "" && !shown.has(primary.toLowerCase());
          return (
            <span key={h.simp} className="simp-hint-item" data-simp={h.simp}>
              <span className="simp-hint-glyph">{h.simp}</span>
              {h.directCodes.length > 0 ? (
                <span className="simp-hint-code">{h.directCodes.map((c) => c.toUpperCase()).join("／")}</span>
              ) : null}
              {h.selectCodes.length > 0 ? (
                <span className="simp-hint-select">
                  <span className="simp-hint-code">{h.selectCodes.map((c) => c.toUpperCase()).join("／")}</span>
                  <span className="simp-hint-tag">要選字</span>
                </span>
              ) : null}
              {showRoots ? (
                <span className="simp-hint-roots">（{formatCodeRoots(primary, props.reps)}）</span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
