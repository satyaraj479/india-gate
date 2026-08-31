import { ZERO, applyBps, cents, type Cents } from "./money";

/**
 * Gate Points.
 *
 * Two rules keep this out of trouble, and both are enforced here rather than
 * in the UI:
 *
 *  1. Points are earned on the amount the guest actually *paid in cash*, not
 *     on the pre-discount subtotal, and never on delivery fees, tips or tax.
 *     Otherwise a 100%-off coupon mints points out of nothing and the
 *     programme becomes a money printer.
 *  2. Redemption is FIFO over earn lots, so the points closest to expiry are
 *     spent first. Anything else quietly expires points a guest thought they
 *     had spent.
 */

export const POINTS_PER_DOLLAR = 10;
/** One point is worth one cent when redeemed. 1,000 points = S$10. */
export const POINT_VALUE_CENTS = 1;
/** Guests cannot pay the whole bill in points; keeps a floor under revenue. */
export const MAX_REDEMPTION_BPS_OF_SUBTOTAL = 5_000; // 50%
export const REDEMPTION_STEP = 100;

export interface EarnInput {
  /** Post-discount, pre-tax food value. */
  eligibleSubtotalCents: Cents;
  /** Cash actually charged. Points never accrue on points. */
  cashPaidCents: Cents;
  /** Tier multiplier in basis points; 12_500 = 1.25×. */
  tierMultiplierBps: number;
  /** Campaign multiplier, stacked multiplicatively. */
  promotionMultiplierBps?: number;
}

export const calculateEarnedPoints = (input: EarnInput): number => {
  const base = Math.min(input.eligibleSubtotalCents, input.cashPaidCents);
  if (base <= 0) return 0;

  const rawPoints = (base / 100) * POINTS_PER_DOLLAR;
  const withTier = (rawPoints * input.tierMultiplierBps) / 10_000;
  const withPromo =
    (withTier * (input.promotionMultiplierBps ?? 10_000)) / 10_000;

  // Floor, not round: never award a point that was not earned.
  return Math.floor(withPromo);
};

export interface RedemptionQuote {
  pointsToRedeem: number;
  discountCents: Cents;
  maxRedeemablePoints: number;
  rejection: "BELOW_STEP" | "INSUFFICIENT_BALANCE" | "EXCEEDS_CAP" | null;
}

export const quoteRedemption = (args: {
  requestedPoints: number;
  balancePoints: number;
  subtotalCents: Cents;
}): RedemptionQuote => {
  const capCents = applyBps(args.subtotalCents, MAX_REDEMPTION_BPS_OF_SUBTOTAL);
  const capPoints =
    Math.floor(capCents / POINT_VALUE_CENTS / REDEMPTION_STEP) *
    REDEMPTION_STEP;
  const maxRedeemable = Math.min(
    capPoints,
    Math.floor(args.balancePoints / REDEMPTION_STEP) * REDEMPTION_STEP,
  );

  if (args.requestedPoints % REDEMPTION_STEP !== 0) {
    return {
      pointsToRedeem: 0,
      discountCents: ZERO,
      maxRedeemablePoints: maxRedeemable,
      rejection: "BELOW_STEP",
    };
  }
  if (args.requestedPoints > args.balancePoints) {
    return {
      pointsToRedeem: 0,
      discountCents: ZERO,
      maxRedeemablePoints: maxRedeemable,
      rejection: "INSUFFICIENT_BALANCE",
    };
  }
  if (args.requestedPoints > capPoints) {
    return {
      pointsToRedeem: 0,
      discountCents: ZERO,
      maxRedeemablePoints: maxRedeemable,
      rejection: "EXCEEDS_CAP",
    };
  }

  return {
    pointsToRedeem: args.requestedPoints,
    discountCents: cents(args.requestedPoints * POINT_VALUE_CENTS),
    maxRedeemablePoints: maxRedeemable,
    rejection: null,
  };
};

export interface EarnLot {
  entryId: string;
  points: number;
  consumedPoints: number;
  expiresAt: Date | null;
}

export interface LotConsumption {
  entryId: string;
  points: number;
}

/**
 * Which lots a redemption draws from. The caller writes one negative ledger
 * entry plus a `consumedPoints` bump on each touched lot, inside the same
 * transaction as the order.
 */
export const consumeLotsFifo = (
  lots: EarnLot[],
  pointsNeeded: number,
  now: Date,
): { consumption: LotConsumption[]; shortfall: number } => {
  const available = lots
    .filter((l) => l.expiresAt === null || l.expiresAt > now)
    .filter((l) => l.points - l.consumedPoints > 0)
    .sort((a, b) => {
      // Nulls last: spend expiring points before non-expiring ones.
      if (a.expiresAt === null) return 1;
      if (b.expiresAt === null) return -1;
      return a.expiresAt.getTime() - b.expiresAt.getTime();
    });

  const consumption: LotConsumption[] = [];
  let remaining = pointsNeeded;

  for (const lot of available) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.points - lot.consumedPoints);
    consumption.push({ entryId: lot.entryId, points: take });
    remaining -= take;
  }

  return { consumption, shortfall: Math.max(0, remaining) };
};
