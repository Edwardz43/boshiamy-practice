import { useEffect, useState, type CSSProperties } from "react";

export type GrokTheme = {
  kind: "light" | "dark";
  bg: { base: string; elevated: string };
  border: { default: string; strong: string; subtle: string };
  fill: { secondary: string };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    accent: string;
    success: string;
  };
  weight: { regular: number; medium: number; semibold: number };
  radius: { full: number };
  font: {
    family: string;
    heading1: CSSProperties;
    heading2: CSSProperties;
    heading3: CSSProperties;
    body1: CSSProperties;
    label: CSSProperties;
    caption: CSSProperties;
  };
};

const family =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "PingFang TC", "Hiragino Sans CNS", "Microsoft JhengHei", sans-serif';

const typography = {
  family,
  heading1: { fontSize: 28, lineHeight: 1.25, fontFamily: family },
  heading2: { fontSize: 22, lineHeight: 1.3, fontFamily: family },
  heading3: { fontSize: 18, lineHeight: 1.35, fontFamily: family },
  body1: { fontSize: 16, lineHeight: 1.55, fontFamily: family },
  label: { fontSize: 14, lineHeight: 1.35, fontFamily: family },
  caption: { fontSize: 12, lineHeight: 1.45, fontFamily: family },
};

const light: GrokTheme = {
  kind: "light",
  bg: { base: "#f4f3ef", elevated: "#ffffff" },
  border: { default: "#ddd9d0", strong: "#c4bfb4", subtle: "#ebe7e0" },
  fill: { secondary: "#ece9e2" },
  text: {
    primary: "#1b1a17",
    secondary: "#5a574f",
    tertiary: "#8a867c",
    accent: "#0b6b8a",
    success: "#1d7040",
  },
  weight: { regular: 400, medium: 500, semibold: 600 },
  radius: { full: 999 },
  font: typography,
};

const dark: GrokTheme = {
  kind: "dark",
  bg: { base: "#121211", elevated: "#1c1c19" },
  border: { default: "#34332e", strong: "#4c4a43", subtle: "#2a2925" },
  fill: { secondary: "#26251f" },
  text: {
    primary: "#f3f1ea",
    secondary: "#b4b0a6",
    tertiary: "#8a867c",
    accent: "#6ec3e0",
    success: "#6dca8f",
  },
  weight: { regular: 400, medium: 500, semibold: 600 },
  radius: { full: 999 },
  font: typography,
};

export function useGrokTheme(): GrokTheme {
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setIsDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    const theme = isDark ? dark : light;
    document.documentElement.style.backgroundColor = theme.bg.base;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark ? "#121211" : "#1c4b3a");
  }, [isDark]);
  return isDark ? dark : light;
}
