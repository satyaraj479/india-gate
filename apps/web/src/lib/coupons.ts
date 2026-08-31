import type { AppliedCoupon, CartItem, FulfilmentMode } from "@/types/cart";
import { lineTotalCents } from "@/types/cart";

/**
 * Promo code rules.
 *
 * The client evaluates these to give instant feedback in the cart drawer. The
 * server re-evaluates the same rules at checkout and its answer wins — this
 * module is a UX affordance, never the authority. Anything that decides what a
 * guest is charged has to be computed somewhere the guest cannot edit.
 */

export type CouponRejectionCode =
  | "NOT_FOUND"
  | "EXPIRED"
  | "MIN_ORDER_NOT_MET"
  | "CHANNEL_INELIGIBLE"
  | "NO_ELIGIBLE_ITEMS";

export interface CouponDefinition {
  code: string;
  label: string;
  description: string;
  kind: "PERCENT_OFF" | "AMOUNT_OFF" | "FREE_DELIVERY";
  /** Basis points for PERCENT_OFF. 1500 = 15%. */
  valueBps?: number;
  valueCents?: number;
  maxDiscountCents?: number;
  minOrderCents: number;
  eligibleModes: FulfilmentMode[];
  /** Restricts the discount to these categories when present. */
  eligibleCategorySlugs?: string[];
  startsAt: string;
  endsAt: string | null;
}

export const COUPONS: CouponDefinition[] = [
  {
    code: "GATE15",
    label: "15% off your order",
    description: "15% off, up to S$8. Minimum spend S$30.",
    kind: "PERCENT_OFF",
    valueBps: 1500,
    maxDiscountCents: 800,
    minOrderCents: 3000,
    eligibleModes: ["DELIVERY", "TAKEAWAY"],
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
  },
  {
    code: "FREEDEL",
    label: "Free delivery",
    description: "Delivery on us. Minimum spend S$35.",
    kind: "FREE_DELIVERY",
    minOrderCents: 3500,
    eligibleModes: ["DELIVERY"],
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
  },
  {
    code: "DUM10",
    label: "S$10 off biryani",
    description: "S$10 off when you spend S$60 or more on biryani.",
    kind: "AMOUNT_OFF",
    valueCents: 1000,
    minOrderCents: 6000,
    eligibleModes: ["DELIVERY", "TAKEAWAY"],
    eligibleCategorySlugs: ["biryani"],
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
  },
  {
    code: "PICKUP5",
    label: "S$5 off self-pickup",
    description: "S$5 off any self-pickup order over S$25.",
    kind: "AMOUNT_OFF",
    valueCents: 500,
    minOrderCents: 2500,
    eligibleModes: ["TAKEAWAY"],
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
  },
];

export type CouponEvaluation =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; code: CouponRejectionCode; message: string };

export interface CouponContext {
  items: CartItem[];
  /** Category of each dish, keyed by dish id — the cart line does not carry it. */
  categoryByDishId: Record<string, string>;
  subtotalCents: number;
  deliveryFeeCents: number;
  fulfilmentMode: FulfilmentMode;
  now: Date;
}

const formatSgd = (c: number) => `S$${(c / 100).toFixed(2)}`;

export const evaluateCoupon = (
  rawCode: string,
  ctx: CouponContext,
): CouponEvaluation => {
  const code = rawCode.trim().toUpperCase();
  const definition = COUPONS.find((c) => c.code === code);

  if (!definition) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "We do not recognise that code.",
    };
  }

  const startsAt = new Date(definition.startsAt);
  const endsAt = definition.endsAt ? new Date(definition.endsAt) : null;
  if (ctx.now < startsAt || (endsAt && ctx.now > endsAt)) {
    return { ok: false, code: "EXPIRED", message: "This code has expired." };
  }

  if (!definition.eligibleModes.includes(ctx.fulfilmentMode)) {
    return {
      ok: false,
      code: "CHANNEL_INELIGIBLE",
      message:
        ctx.fulfilmentMode === "DELIVERY"
          ? "This code is for self-pickup orders."
          : "This code is for delivery orders.",
    };
  }

  // The minimum is measured against the *eligible* value, not the whole cart.
  // A "S$10 off biryani over S$60" code must not unlock on S$60 of desserts.
  const eligibleCents = definition.eligibleCategorySlugs
    ? ctx.items
        .filter((item) =>
          definition.eligibleCategorySlugs!.includes(
            ctx.categoryByDishId[item.dishId] ?? "",
          ),
        )
        .reduce((sum, item) => sum + lineTotalCents(item), 0)
    : ctx.subtotalCents;

  if (eligibleCents === 0) {
    return {
      ok: false,
      code: "NO_ELIGIBLE_ITEMS",
      message: "Add an eligible item to use this code.",
    };
  }

  if (eligibleCents < definition.minOrderCents) {
    const shortfall = definition.minOrderCents - eligibleCents;
    return {
      ok: false,
      code: "MIN_ORDER_NOT_MET",
      message: `Spend ${formatSgd(shortfall)} more to use this code.`,
    };
  }

  if (definition.kind === "FREE_DELIVERY") {
    return {
      ok: true,
      coupon: {
        code: definition.code,
        label: definition.label,
        discountCents: ctx.deliveryFeeCents,
        appliesTo: "DELIVERY_FEE",
      },
    };
  }

  const raw =
    definition.kind === "PERCENT_OFF"
      ? Math.round((eligibleCents * (definition.valueBps ?? 0)) / 10_000)
      : (definition.valueCents ?? 0);

  // Never discount past the cart value, and honour the cap.
  const capped = Math.min(
    raw,
    definition.maxDiscountCents ?? Number.MAX_SAFE_INTEGER,
    ctx.subtotalCents,
  );

  return {
    ok: true,
    coupon: {
      code: definition.code,
      label: definition.label,
      discountCents: capped,
      appliesTo: "CART",
    },
  };
};
