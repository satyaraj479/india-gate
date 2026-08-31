import "server-only";

/**
 * The canonical origin for this deployment.
 *
 * This exists because of a bug that only ever appears in a hosting
 * environment. The obvious form —
 *
 *     process.env.NEXT_PUBLIC_SITE_URL ?? "https://indiagate.sg"
 *
 * — is wrong. `??` falls back on `null` and `undefined` but *not* on an empty
 * string, and a build platform that declares a variable without a value hands
 * it over as `""`. The fallback never fires, `new URL("")` throws
 * `ERR_INVALID_URL`, and the build dies collecting page data for `/_not-found`
 * with no mention of the actual culprit. Locally the variable does not exist
 * at all, so `??` works and everything passes — which is what makes this class
 * of bug expensive.
 *
 * `||` plus a trim is the correct guard: it treats empty and whitespace-only
 * as absent, which is what "unset" means in practice.
 *
 * Server-only. It reads `VERCEL_URL`, which is not inlined into the client
 * bundle; a client component importing this would silently get the wrong
 * origin, so the import fails the build instead.
 */
export const getSiteUrl = (): string => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Vercel sets these itself. The production URL is stable across deploys;
  // VERCEL_URL is per-deployment and is what preview builds get.
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
};
