import type { JSX } from "react";

export type KeycapCompareItem = {
  letter: string;
  ok: boolean;
  roots?: string;
};

export function diffKeycaps(typedRaw: string, targetRaw: string, reps: Record<string, string>): KeycapCompareItem[] {
  const typed = typedRaw.trim().toLowerCase();
  const target = targetRaw.trim().toLowerCase();
  const out: KeycapCompareItem[] = [];
  for (let i = 0; i < typed.length; i++) {
    const ch = typed[i];
    out.push({
      letter: ch.toUpperCase(),
      ok: i < target.length && ch === target[i],
      roots: reps[ch],
    });
  }
  return out;
}

export function KeycapBreakdown(props: {
  code: string;
  altCode?: string;
  typedCode?: string;
  verdict: "ok" | "bad";
  reps: Record<string, string>;
  label?: string;
  altLabel?: string;
  compact?: boolean;
}): JSX.Element | null {
  const primary = props.code.trim().toLowerCase();
  if (!primary) return null;
  const alt = props.altCode?.trim().toLowerCase();
  const showCompare =
    props.verdict === "bad" &&
    props.typedCode != null &&
    props.typedCode.trim().length > 0 &&
    props.typedCode.trim().toLowerCase() !== primary;
  const typedItems = showCompare ? diffKeycaps(props.typedCode ?? "", primary, props.reps) : [];

  const renderRow = (
    codeStr: string,
    rowKind: "ok" | "target" | "alt",
    rowLabel?: string,
  ): JSX.Element => {
    const letters = codeStr.split("");
    return (
      <div className={"keycap-row is-" + rowKind}>
        {rowLabel ? <span className="keycap-row-label">{rowLabel}</span> : null}
        <div className="keycap-seq">
          {letters.map((ch, idx) => (
            <div key={ch + idx} className={"keycap-unit is-" + rowKind}>
              <div className="keycap-cap">
                <span className="keycap-step">{idx + 1}</span>
                <span className="keycap-letter">{ch.toUpperCase()}</span>
              </div>
              <div className="keycap-roots">{props.reps[ch] ?? ""}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={"keycap-breakdown" + (props.compact ? " is-compact" : "")}
      data-testid="keycap-breakdown"
    >
      {showCompare ? (
        <div className="keycap-row is-typed" data-testid="keycap-typed-row">
          <span className="keycap-row-label">你打的</span>
          <div className="keycap-seq">
            {typedItems.map((it, idx) => (
              <div
                key={it.letter + idx}
                className={"keycap-unit " + (it.ok ? "is-match" : "is-mismatch")}
              >
                <div className="keycap-cap">
                  <span className="keycap-step">{idx + 1}</span>
                  <span className="keycap-letter">{it.letter}</span>
                </div>
                {it.roots ? <div className="keycap-roots">{it.roots}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {renderRow(
        primary,
        props.verdict === "ok" ? "ok" : "target",
        props.label ?? (showCompare ? "正解" : undefined),
      )}
      {alt && alt !== primary ? renderRow(alt, "alt", props.altLabel ?? "全碼") : null}
    </div>
  );
}
