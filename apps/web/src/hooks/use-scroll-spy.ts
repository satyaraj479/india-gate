"use client";

import { useEffect, useState } from "react";

/**
 * Highlights the category rail entry for whichever menu section is in view.
 *
 * IntersectionObserver rather than a scroll listener: no layout thrash, no
 * throttling to tune, and it stays smooth on a mid-range phone scrolling a
 * thirty-dish menu.
 *
 * `rootMargin` pulls the detection band down past the sticky header and up
 * from the bottom, so the active section is the one under the *reading* area
 * rather than the one clipping the viewport edge. Without it the rail flickers
 * between two categories on every scroll.
 */
export function useScrollSpy(
  ids: string[],
  options?: { rootMargin?: string },
): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    // Track ratios ourselves rather than trusting whichever entry fired last:
    // with several sections crossing the band at once, "last entry wins" picks
    // an arbitrary one.
    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        if (best) setActiveId(best);
      },
      {
        rootMargin: options?.rootMargin ?? "-140px 0px -55% 0px",
        threshold: [0, 0.15, 0.35, 0.6, 1],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids, options?.rootMargin]);

  return activeId;
}
