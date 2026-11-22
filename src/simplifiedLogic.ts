// Pure helpers for simplified-form Boshiamy code hints during practice drills (no React).
import type { Table, Variants } from "./lookupLogic";
import { SIMPLIFIED_CODE_MAP } from "./simplifiedData";

export type SimpHint = {
  simp: string;
  directCodes: string[];
  selectCodes: string[];
};

// Characters whose simplified form only has minor stroke adjustments with identical structure/code.
export const TRIVIAL_STROKE_VARIANTS = new Set(["內", "別", "戶", "稅", "搖"]);

function splitTableCodes(raw: string | undefined): { direct: string[]; select: string[] } {
  if (!raw) return { direct: [], select: [] };
  const [k = "", a = ""] = raw.split("|");
  return {
    direct: k.split(" ").filter(Boolean),
    select: a.split(" ").filter(Boolean),
  };
}

/** Finds simplified variants in the full code table that share direct or select codes with the traditional char. */
export function findTableSimplifiedHints(table: Table, vars: Variants | null, ch: string): SimpHint[] {
  if (!vars || TRIVIAL_STROKE_VARIANTS.has(ch)) return [];
  const tradEntry = table[ch];
  if (!tradEntry) return [];
  const simps = vars.t2s[ch];
  if (!simps || simps.length === 0) return [];

  const trad = splitTableCodes(tradEntry);
  const tradDirect = new Set(trad.direct);
  const tradSelect = new Set(trad.select);
  const out: SimpHint[] = [];

  for (const simp of simps) {
    const simpEntry = table[simp];
    if (!simpEntry) continue;
    const sc = splitTableCodes(simpEntry);
    const allSimp = [...sc.direct, ...sc.select];
    const directCodes = allSimp.filter((c) => tradDirect.has(c));
    const selectCodes = allSimp.filter((c) => !tradDirect.has(c) && tradSelect.has(c));
    if (directCodes.length > 0 || selectCodes.length > 0) {
      out.push({ simp, directCodes, selectCodes });
    }
  }
  return out;
}

/** Returns simplified-form code hints for a character, using curated top-1000 hints first then optional table lookup. */
export function getSimplifiedHints(ch: string, table?: Table | null, vars?: Variants | null): SimpHint[] {
  const mapped = SIMPLIFIED_CODE_MAP[ch];
  if (mapped) {
    return mapped.map(([simp, directCodes, selectCodes]) => ({
      simp,
      directCodes: [...directCodes],
      selectCodes: [...selectCodes],
    }));
  }
  if (TRIVIAL_STROKE_VARIANTS.has(ch)) return [];
  if (table && vars) return findTableSimplifiedHints(table, vars, ch);
  return [];
}

/** Formats root breakdown of one Boshiamy code using uppercase keys and representative roots. */
export function formatCodeRoots(code: string, reps: Record<string, string>): string {
  return code
    .toLowerCase()
    .split("")
    .map((ch) => ch.toUpperCase() + (reps[ch] ? " " + reps[ch] : ""))
    .join("；");
}
