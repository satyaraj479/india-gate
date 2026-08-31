"use client";

import { useEffect, useState } from "react";

/**
 * True only after the first client-side effect has run.
 *
 * The cart lives in localStorage, which the server cannot see. Rendering a
 * badge that says "3" on the client and nothing on the server is a hydration
 * mismatch: React discards the server HTML for that subtree and logs an error,
 * and in production you get a flash of the wrong content.
 *
 * Every component that reads persisted state renders a neutral placeholder
 * until this returns true. It is one extra frame; it is not worth being clever
 * about.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
