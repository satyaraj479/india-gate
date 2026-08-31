/**
 * Money is an integer number of minor units plus a currency. There is no
 * float arithmetic anywhere in this codebase, and no `number` field holding a
 * price without a `Cents` suffix.
 *
 * The type is a branded number rather than a class so it serialises to JSON
 * as a plain integer and costs nothing to pass across the wire.
 */
export type Cents = number & { readonly __brand: "Cents" };

export const cents = (n: number): Cents => {
  if (!Number.isInteger(n)) {
    throw new TypeError(`Money must be an integer number of cents, got ${n}`);
  }
  return n as Cents;
};

export const ZERO = cents(0);

export const add = (...values: Cents[]): Cents =>
  cents(values.reduce<number>((a, b) => a + b, 0));

export const subtract = (a: Cents, b: Cents): Cents => cents(a - b);

export const multiply = (amount: Cents, quantity: number): Cents => {
  if (!Number.isInteger(quantity)) {
    throw new TypeError(`Quantity must be an integer, got ${quantity}`);
  }
  return cents(amount * quantity);
};

/**
 * Basis points, because percentages invite floats. 900 bps = 9%.
 *
 * Rounding is half-up on the absolute value, so a discount and its reversal
 * are exact inverses. Banker's rounding would be more "correct" statistically
 * and would break that property, which matters more here: a refund that is
 * one cent off the original charge is a support ticket.
 */
export const applyBps = (amount: Cents, bps: number): Cents => {
  const raw = (amount * bps) / 10_000;
  const rounded = Math.sign(raw) * Math.round(Math.abs(raw));
  return cents(rounded);
};

/** Tax on a tax-inclusive price: 9% GST inside S$10.90 is S$0.90, not S$0.98. */
export const extractInclusiveTax = (grossAmount: Cents, bps: number): Cents =>
  cents(Math.round((grossAmount * bps) / (10_000 + bps)));

export const clampToZero = (amount: Cents): Cents =>
  amount < 0 ? ZERO : amount;

/**
 * Split an amount across n lines so the parts sum exactly to the whole.
 * Used when a cart-level discount has to be attributed to individual lines
 * for the receipt and for partial refunds. Naive per-line rounding loses
 * cents; this hands the remainder out one cent at a time to the largest
 * lines first.
 */
export const allocate = (amount: Cents, weights: number[]): Cents[] => {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return weights.map(() => ZERO);

  const raw = weights.map((w) => (amount * w) / totalWeight);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = amount - floored.reduce((a, b) => a + b, 0);

  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floored];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] = (result[i] ?? 0) + 1;
    remainder -= 1;
  }
  return result.map(cents);
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();

export const format = (
  amount: Cents,
  currency: string,
  locale = "en-SG",
): string => {
  const key = `${locale}:${currency}`;
  let fmt = FORMATTERS.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: "currency", currency });
    FORMATTERS.set(key, fmt);
  }
  return fmt.format(amount / 100);
};

/** The wire shape. Both clients render `formatted`; only the server sets it. */
export interface MoneyDTO {
  cents: number;
  currency: string;
  formatted: string;
}

export const toDTO = (
  amount: Cents,
  currency: string,
  locale = "en-SG",
): MoneyDTO => ({
  cents: amount,
  currency,
  formatted: format(amount, currency, locale),
});
