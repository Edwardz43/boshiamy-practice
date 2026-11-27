import { useEffect, useState } from "react";

const QUERY = "(pointer: coarse), (max-width: 767px)";
const TOUCH_QUERY = "(pointer: coarse)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (): void => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(QUERY);
}

export function useIsTouch(): boolean {
  return useMediaQuery(TOUCH_QUERY);
}
