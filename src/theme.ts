import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from "react";

export type ThemeId = "ink" | "studio" | "playful" | "minimal";
export type ColorMode = "system" | "light" | "dark";

export const THEME_KEY = "boshiamy-theme-v1";
export const COLOR_MODE_KEY = "boshiamy-color-mode-v1";

export function isThemeId(v: unknown): v is ThemeId {
  return v === "ink" || v === "studio" || v === "playful" || v === "minimal";
}

export function isColorMode(v: unknown): v is ColorMode {
  return v === "system" || v === "light" || v === "dark";
}

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  desc: string;
  swatches: {
    light: [string, string, string, string];
    dark: [string, string, string, string];
  };
};

export const THEME_LIST: ThemeMeta[] = [
  {
    id: "ink",
    name: "文房墨綠",
    desc: "溫潤宣紙與墨綠米字格",
    swatches: {
      light: ["#f5f2ea", "#fffdf8", "#1c4b3a", "#b84233"],
      dark: ["#111513", "#19201d", "#3d8b6b", "#e06c5b"],
    },
  },
  {
    id: "studio",
    name: "鍵盤工作室",
    desc: "俐落鍵帽感與 IDE 配色",
    swatches: {
      light: ["#eff2f7", "#ffffff", "#3b5bdb", "#d9480f"],
      dark: ["#131620", "#1b1f2e", "#7aa2f7", "#f7768e"],
    },
  },
  {
    id: "playful",
    name: "晴朗練功",
    desc: "明快圓潤與輕光暈回饋",
    swatches: {
      light: ["#f3f7f6", "#ffffff", "#0d8a78", "#ea580c"],
      dark: ["#101923", "#182433", "#2dd4bf", "#fb923c"],
    },
  },
  {
    id: "minimal",
    name: "極簡紙感",
    desc: "低干擾單色純淨練字",
    swatches: {
      light: ["#f6f6f4", "#ffffff", "#242422", "#57534e"],
      dark: ["#141413", "#1e1e1c", "#e8e6df", "#a8a29e"],
    },
  },
];

export type GrokTheme = {
  id: ThemeId;
  kind: "light" | "dark";
  bg: { base: string; elevated: string; subtle: string };
  border: { default: string; strong: string; subtle: string };
  fill: {
    secondary: string;
    primarySoft: string;
    successSoft: string;
    dangerSoft: string;
    accentSoft: string;
  };
  brand: {
    primary: string;
    primaryHover: string;
    primaryText: string;
    seal: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    accent: string;
    success: string;
    danger: string;
  };
  shadow: {
    sm: string;
    md: string;
    key: string;
    focus: string;
  };
  weight: { regular: number; medium: number; semibold: number };
  radius: { card: number; control: number; key: number; full: number };
  font: {
    family: string;
    mono: string;
    heading1: CSSProperties;
    heading2: CSSProperties;
    heading3: CSSProperties;
    body1: CSSProperties;
    label: CSSProperties;
    caption: CSSProperties;
  };
  metaThemeColor: string;
};

const family =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "PingFang TC", "Hiragino Sans CNS", "Microsoft JhengHei", sans-serif';
const mono = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

const typography = {
  family,
  mono,
  heading1: { fontSize: 28, lineHeight: 1.25, fontFamily: family },
  heading2: { fontSize: 22, lineHeight: 1.3, fontFamily: family },
  heading3: { fontSize: 18, lineHeight: 1.35, fontFamily: family },
  body1: { fontSize: 16, lineHeight: 1.55, fontFamily: family },
  label: { fontSize: 14, lineHeight: 1.35, fontFamily: family },
  caption: { fontSize: 12, lineHeight: 1.45, fontFamily: family },
};

const weight = { regular: 400, medium: 500, semibold: 600 };

const THEMES: Record<ThemeId, { light: GrokTheme; dark: GrokTheme }> = {
  ink: {
    light: {
      id: "ink",
      kind: "light",
      bg: { base: "#f5f2ea", elevated: "#fffdf8", subtle: "#ece7db" },
      border: { subtle: "#e6e0d2", default: "#d8d1c2", strong: "#b5ad9c" },
      fill: {
        secondary: "#eae4d7",
        primarySoft: "rgba(28, 75, 58, 0.11)",
        successSoft: "rgba(29, 112, 64, 0.12)",
        dangerSoft: "rgba(184, 59, 46, 0.11)",
        accentSoft: "rgba(28, 75, 58, 0.08)",
      },
      brand: { primary: "#1c4b3a", primaryHover: "#153b2d", primaryText: "#f7f4ec", seal: "#b84233" },
      text: {
        primary: "#1b1c19",
        secondary: "#54564e",
        tertiary: "#78776e",
        accent: "#1c4b3a",
        success: "#1d7040",
        danger: "#b83b2e",
      },
      shadow: {
        sm: "0 1px 2px rgba(27, 28, 25, 0.05)",
        md: "0 6px 20px rgba(27, 28, 25, 0.06)",
        key: "0 2px 0 rgba(27, 28, 25, 0.12)",
        focus: "0 0 0 3px rgba(28, 75, 58, 0.2)",
      },
      weight,
      radius: { card: 18, control: 12, key: 9, full: 999 },
      font: typography,
      metaThemeColor: "#1c4b3a",
    },
    dark: {
      id: "ink",
      kind: "dark",
      bg: { base: "#111513", elevated: "#19201d", subtle: "#202925" },
      border: { subtle: "#25302b", default: "#324039", strong: "#4b5e54" },
      fill: {
        secondary: "#232d28",
        primarySoft: "rgba(61, 139, 107, 0.22)",
        successSoft: "rgba(109, 202, 143, 0.18)",
        dangerSoft: "rgba(240, 128, 116, 0.18)",
        accentSoft: "rgba(122, 212, 173, 0.14)",
      },
      brand: { primary: "#3d8b6b", primaryHover: "#4aa07d", primaryText: "#f3f7f4", seal: "#e06c5b" },
      text: {
        primary: "#eef2ee",
        secondary: "#b2bdb6",
        tertiary: "#85928a",
        accent: "#7ad4ad",
        success: "#6dca8f",
        danger: "#f08074",
      },
      shadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.28)",
        md: "0 8px 24px rgba(0, 0, 0, 0.34)",
        key: "0 2px 0 rgba(0, 0, 0, 0.5)",
        focus: "0 0 0 3px rgba(122, 212, 173, 0.24)",
      },
      weight,
      radius: { card: 18, control: 12, key: 9, full: 999 },
      font: typography,
      metaThemeColor: "#111513",
    },
  },
  studio: {
    light: {
      id: "studio",
      kind: "light",
      bg: { base: "#eff2f7", elevated: "#ffffff", subtle: "#e3e8f0" },
      border: { subtle: "#e2e7f0", default: "#cfd7e3", strong: "#a7b3c7" },
      fill: {
        secondary: "#e5eaf3",
        primarySoft: "rgba(59, 91, 219, 0.11)",
        successSoft: "rgba(27, 122, 75, 0.12)",
        dangerSoft: "rgba(201, 42, 42, 0.11)",
        accentSoft: "rgba(54, 79, 199, 0.09)",
      },
      brand: { primary: "#3b5bdb", primaryHover: "#2f4cc0", primaryText: "#ffffff", seal: "#d9480f" },
      text: {
        primary: "#171c26",
        secondary: "#4c5567",
        tertiary: "#737e93",
        accent: "#364fc7",
        success: "#1b7a4b",
        danger: "#c92a2a",
      },
      shadow: {
        sm: "0 1px 2px rgba(23, 28, 38, 0.06)",
        md: "0 6px 20px rgba(23, 28, 38, 0.07)",
        key: "0 2px 0 rgba(23, 28, 38, 0.14)",
        focus: "0 0 0 3px rgba(59, 91, 219, 0.22)",
      },
      weight,
      radius: { card: 14, control: 10, key: 8, full: 999 },
      font: typography,
      metaThemeColor: "#3b5bdb",
    },
    dark: {
      id: "studio",
      kind: "dark",
      bg: { base: "#131620", elevated: "#1b1f2e", subtle: "#23283b" },
      border: { subtle: "#262c40", default: "#323952", strong: "#4b5578" },
      fill: {
        secondary: "#252b40",
        primarySoft: "rgba(122, 162, 247, 0.18)",
        successSoft: "rgba(115, 218, 202, 0.18)",
        dangerSoft: "rgba(247, 118, 142, 0.18)",
        accentSoft: "rgba(125, 207, 255, 0.14)",
      },
      brand: { primary: "#7aa2f7", primaryHover: "#8eb2ff", primaryText: "#0f1320", seal: "#f7768e" },
      text: {
        primary: "#e6ebf7",
        secondary: "#a9b3cb",
        tertiary: "#7b85a1",
        accent: "#7dcfff",
        success: "#73daca",
        danger: "#f7768e",
      },
      shadow: {
        sm: "0 1px 3px rgba(0, 0, 0, 0.34)",
        md: "0 10px 26px rgba(0, 0, 0, 0.4)",
        key: "0 2px 0 rgba(0, 0, 0, 0.56)",
        focus: "0 0 0 3px rgba(122, 162, 247, 0.28)",
      },
      weight,
      radius: { card: 14, control: 10, key: 8, full: 999 },
      font: typography,
      metaThemeColor: "#131620",
    },
  },
  playful: {
    light: {
      id: "playful",
      kind: "light",
      bg: { base: "#f3f7f6", elevated: "#ffffff", subtle: "#e6f0ee" },
      border: { subtle: "#dce9e6", default: "#c5dad5", strong: "#99bdb4" },
      fill: {
        secondary: "#e2efec",
        primarySoft: "rgba(13, 138, 120, 0.12)",
        successSoft: "rgba(21, 128, 61, 0.12)",
        dangerSoft: "rgba(220, 38, 38, 0.11)",
        accentSoft: "rgba(2, 132, 199, 0.1)",
      },
      brand: { primary: "#0d8a78", primaryHover: "#0a7364", primaryText: "#ffffff", seal: "#ea580c" },
      text: {
        primary: "#142220",
        secondary: "#475f5b",
        tertiary: "#6f8783",
        accent: "#0284c7",
        success: "#15803d",
        danger: "#dc2626",
      },
      shadow: {
        sm: "0 2px 4px rgba(13, 138, 120, 0.06)",
        md: "0 8px 24px rgba(13, 138, 120, 0.08)",
        key: "0 2px 0 rgba(13, 138, 120, 0.14)",
        focus: "0 0 0 3px rgba(13, 138, 120, 0.22)",
      },
      weight,
      radius: { card: 22, control: 14, key: 11, full: 999 },
      font: typography,
      metaThemeColor: "#0d8a78",
    },
    dark: {
      id: "playful",
      kind: "dark",
      bg: { base: "#101923", elevated: "#182433", subtle: "#1f2f42" },
      border: { subtle: "#223449", default: "#2d435e", strong: "#456386" },
      fill: {
        secondary: "#1f3044",
        primarySoft: "rgba(45, 212, 191, 0.18)",
        successSoft: "rgba(74, 222, 128, 0.18)",
        dangerSoft: "rgba(251, 113, 133, 0.18)",
        accentSoft: "rgba(56, 189, 248, 0.15)",
      },
      brand: { primary: "#2dd4bf", primaryHover: "#5eead4", primaryText: "#0b191d", seal: "#fb923c" },
      text: {
        primary: "#ecf4f8",
        secondary: "#a7bccb",
        tertiary: "#7b93a6",
        accent: "#38bdf8",
        success: "#4ade80",
        danger: "#fb7185",
      },
      shadow: {
        sm: "0 2px 4px rgba(0, 0, 0, 0.3)",
        md: "0 10px 26px rgba(0, 0, 0, 0.36)",
        key: "0 2px 0 rgba(0, 0, 0, 0.52)",
        focus: "0 0 0 3px rgba(45, 212, 191, 0.26)",
      },
      weight,
      radius: { card: 22, control: 14, key: 11, full: 999 },
      font: typography,
      metaThemeColor: "#101923",
    },
  },
  minimal: {
    light: {
      id: "minimal",
      kind: "light",
      bg: { base: "#f6f6f4", elevated: "#ffffff", subtle: "#ecece8" },
      border: { subtle: "#e6e6e1", default: "#d5d5ce", strong: "#b0b0a6" },
      fill: {
        secondary: "#eaeae5",
        primarySoft: "rgba(36, 36, 34, 0.08)",
        successSoft: "rgba(45, 106, 79, 0.11)",
        dangerSoft: "rgba(153, 27, 27, 0.1)",
        accentSoft: "rgba(63, 63, 60, 0.08)",
      },
      brand: { primary: "#242422", primaryHover: "#111110", primaryText: "#fafaf8", seal: "#57534e" },
      text: {
        primary: "#1a1a18",
        secondary: "#575752",
        tertiary: "#7e7e77",
        accent: "#3f3f3c",
        success: "#2d6a4f",
        danger: "#991b1b",
      },
      shadow: {
        sm: "0 1px 2px rgba(26, 26, 24, 0.04)",
        md: "0 4px 14px rgba(26, 26, 24, 0.05)",
        key: "0 1px 0 rgba(26, 26, 24, 0.12)",
        focus: "0 0 0 3px rgba(36, 36, 34, 0.16)",
      },
      weight,
      radius: { card: 16, control: 10, key: 8, full: 999 },
      font: typography,
      metaThemeColor: "#242422",
    },
    dark: {
      id: "minimal",
      kind: "dark",
      bg: { base: "#141413", elevated: "#1e1e1c", subtle: "#272724" },
      border: { subtle: "#282825", default: "#373733", strong: "#52524c" },
      fill: {
        secondary: "#282825",
        primarySoft: "rgba(232, 230, 223, 0.14)",
        successSoft: "rgba(116, 198, 157, 0.16)",
        dangerSoft: "rgba(248, 113, 113, 0.16)",
        accentSoft: "rgba(214, 211, 203, 0.12)",
      },
      brand: { primary: "#e8e6df", primaryHover: "#ffffff", primaryText: "#141413", seal: "#a8a29e" },
      text: {
        primary: "#f0efe9",
        secondary: "#b5b4ac",
        tertiary: "#86857e",
        accent: "#d6d3cb",
        success: "#74c69d",
        danger: "#f87171",
      },
      shadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.25)",
        md: "0 6px 18px rgba(0, 0, 0, 0.3)",
        key: "0 1px 0 rgba(0, 0, 0, 0.45)",
        focus: "0 0 0 3px rgba(232, 230, 223, 0.2)",
      },
      weight,
      radius: { card: 16, control: 10, key: 8, full: 999 },
      font: typography,
      metaThemeColor: "#141413",
    },
  },
};

function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (isThemeId(raw)) return raw;
  } catch {
    /* ignore storage errors */
  }
  return "ink";
}

function readStoredColorMode(): ColorMode {
  try {
    const raw = localStorage.getItem(COLOR_MODE_KEY);
    if (isColorMode(raw)) return raw;
  } catch {
    /* ignore storage errors */
  }
  return "system";
}

function getSystemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(id: ThemeId, mode: ColorMode, systemDark: boolean): GrokTheme {
  const kind: "light" | "dark" = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  return THEMES[id][kind];
}

export function applyThemeToDom(theme: GrokTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.dataset.mode = theme.kind;
  const s = root.style;
  s.setProperty("--bg-base", theme.bg.base);
  s.setProperty("--bg-elevated", theme.bg.elevated);
  s.setProperty("--bg-subtle", theme.bg.subtle);
  s.setProperty("--border-subtle", theme.border.subtle);
  s.setProperty("--border-default", theme.border.default);
  s.setProperty("--border-strong", theme.border.strong);
  s.setProperty("--fill-secondary", theme.fill.secondary);
  s.setProperty("--fill-primary-soft", theme.fill.primarySoft);
  s.setProperty("--fill-success-soft", theme.fill.successSoft);
  s.setProperty("--fill-danger-soft", theme.fill.dangerSoft);
  s.setProperty("--fill-accent-soft", theme.fill.accentSoft);
  s.setProperty("--brand-primary", theme.brand.primary);
  s.setProperty("--brand-primary-hover", theme.brand.primaryHover);
  s.setProperty("--brand-primary-text", theme.brand.primaryText);
  s.setProperty("--brand-seal", theme.brand.seal);
  s.setProperty("--text-primary", theme.text.primary);
  s.setProperty("--text-secondary", theme.text.secondary);
  s.setProperty("--text-tertiary", theme.text.tertiary);
  s.setProperty("--text-accent", theme.text.accent);
  s.setProperty("--text-success", theme.text.success);
  s.setProperty("--text-danger", theme.text.danger);
  s.setProperty("--shadow-sm", theme.shadow.sm);
  s.setProperty("--shadow-md", theme.shadow.md);
  s.setProperty("--shadow-key", theme.shadow.key);
  s.setProperty("--shadow-focus", theme.shadow.focus);
  s.setProperty("--radius-card", theme.radius.card + "px");
  s.setProperty("--radius-control", theme.radius.control + "px");
  s.setProperty("--radius-key", theme.radius.key + "px");
  s.setProperty("--font-sans", theme.font.family);
  s.setProperty("--font-mono", theme.font.mono);
  s.backgroundColor = theme.bg.base;
  s.colorScheme = theme.kind;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.metaThemeColor);
}

export function initThemeFromStorage(): void {
  const id = readStoredTheme();
  const mode = readStoredColorMode();
  const theme = resolveTheme(id, mode, getSystemDark());
  applyThemeToDom(theme);
}

export type ThemeContextValue = {
  themeId: ThemeId;
  colorMode: ColorMode;
  theme: GrokTheme;
  setThemeId: (id: ThemeId) => void;
  setColorMode: (mode: ColorMode) => void;
  setPreview: (id: ThemeId | null, mode?: ColorMode | null) => void;
  clearPreview: () => void;
};

const fallbackTheme = THEMES.ink.light;

const ThemeContext = createContext<ThemeContextValue>({
  themeId: "ink",
  colorMode: "system",
  theme: fallbackTheme,
  setThemeId: () => undefined,
  setColorMode: () => undefined,
  setPreview: () => undefined,
  clearPreview: () => undefined,
});

export function ThemeProvider(props: { children: ReactNode }): JSX.Element {
  const [themeId, setThemeIdState] = useState<ThemeId>(readStoredTheme);
  const [colorMode, setColorModeState] = useState<ColorMode>(readStoredColorMode);
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId | null>(null);
  const [previewColorMode, setPreviewColorMode] = useState<ColorMode | null>(null);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setThemeId = useCallback((id: ThemeId): void => {
    setThemeIdState(id);
    setPreviewThemeId(null);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const setColorMode = useCallback((mode: ColorMode): void => {
    setColorModeState(mode);
    setPreviewColorMode(null);
    try {
      localStorage.setItem(COLOR_MODE_KEY, mode);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const setPreview = useCallback((id: ThemeId | null, mode?: ColorMode | null): void => {
    setPreviewThemeId(id);
    if (mode !== undefined) setPreviewColorMode(mode);
  }, []);

  const clearPreview = useCallback((): void => {
    setPreviewThemeId(null);
    setPreviewColorMode(null);
  }, []);

  const activeId = previewThemeId ?? themeId;
  const activeMode = previewColorMode ?? colorMode;

  const theme = useMemo(
    () => resolveTheme(activeId, activeMode, systemDark),
    [activeId, activeMode, systemDark],
  );

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      colorMode,
      theme,
      setThemeId,
      setColorMode,
      setPreview,
      clearPreview,
    }),
    [themeId, colorMode, theme, setThemeId, setColorMode, setPreview, clearPreview],
  );

  return createElement(ThemeContext.Provider, { value }, props.children);
}

export function useThemeControl(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useGrokTheme(): GrokTheme {
  return useContext(ThemeContext).theme;
}
