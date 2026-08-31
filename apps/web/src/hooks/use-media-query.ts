"use client";

import { useEffect, useState } from "react";

/**
 * Returns false on the server and on first paint, then the real answer.
 *
 * Deliberately not used for layout — that is Tailwind's job, and doing
 * breakpoints in JS reintroduces the hydration mismatch CSS already solved.
 * This exists for genuine behaviour differences, such as whether the
 * customise sheet traps focus or the category rail scrolls its active chip
 * into view.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
