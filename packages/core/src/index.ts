/**
 * @indiagate/core — platform-neutral domain logic.
 *
 * HARD RULE: nothing in this package may import from `react`, `next`,
 * `react-native`, `@prisma/client`, `node:*`, or touch `window`, `document`,
 * `process.env`, `Date.now()` or `Math.random()`. Everything is a pure
 * function of its arguments, including the clock — callers pass `now`.
 *
 * That rule is what lets the identical code run inside a NestJS transaction,
 * a React Server Component and a Hermes bundle. It is enforced by an ESLint
 * `no-restricted-imports` rule in `@indiagate/eslint-config/core`, not by
 * good intentions.
 */
export * from "./money";
export * from "./time";
export * from "./loyalty";
export * from "./pricing/catering";
export * from "./pricing/cart";
