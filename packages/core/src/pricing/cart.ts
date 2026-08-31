import {
  ZERO,
  add,
  allocate,
  applyBps,
  cents,
  clampToZero,
  extractInclusiveTax,
  multiply,
  subtract,
  type Cents,
} from "../money";

/**
 * A la carte cart pricing. Same three-callers argument as the catering
 * engine: the mobile cart badge, the web checkout summary, and the
 * authoritative checkout transaction all call this.
 *
 * Order of operations is fixed and deliberate:
 *   line totals → item discounts → cart discount → points → fees → tax → tip
 *
 * In particular, points and coupons apply to *food value only*, before
 * delivery fee, and tax is computed on the discounted amount. Getting this
 * order wrong is not a rounding nit — it changes what the guest owes and what
 * the tax authority is owed.
 */

export interface CartLineInput {
  id: string;
  quantity: number;
  unitPriceCents: Cents;
  modifiers: Array<{ priceDeltaCents: Cents; quantity: number }>;
}

export interface CartPricingContext {
  currency: string;
  taxRateBps: number;
  taxInclusive: boolean;
  packagingFeeCents: Cents;
  serviceChargeBps: number;
  deliveryFeeCents: Cents;
  freeDeliveryAboveCents: Cents | null;
  tipCents: Cents;
  /** Resolved by the coupon service; already validated against the cart. */
  couponDiscountCents: Cents;
  /** Whether the coupon zeroes the delivery fee instead of the food total. */
  couponAppliesToDeliveryFee: boolean;
  pointsRedeemed: number;
  pointValueCents: number;
}

export interface PricedLine {
  id: string;
  quantity: number;
  unitPriceCents: Cents;
  modifierTotalCents: Cents;
  lineDiscountCents: Cents;
  lineTotalCents: Cents;
}

export interface CartTotals {
  currency: string;
  lines: PricedLine[];
  subtotalCents: Cents;
  discountTotalCents: Cents;
  deliveryFeeCents: Cents;
  packagingFeeCents: Cents;
  serviceChargeCents: Cents;
  taxCents: Cents;
  tipCents: Cents;
  totalCents: Cents;
  pointsRedeemed: number;
  amountToFreeDeliveryCents: Cents | null;
}

export const priceCart = (
  lines: CartLineInput[],
  ctx: CartPricingContext,
): CartTotals => {
  // -- Line totals ---------------------------------------------------------
  const priced: PricedLine[] = lines.map((line) => {
    const modifierPerUnit = add(
      ...line.modifiers.map((m) => multiply(m.priceDeltaCents, m.quantity)),
    );
    const gross = multiply(
      add(line.unitPriceCents, modifierPerUnit),
      line.quantity,
    );
    return {
      id: line.id,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      modifierTotalCents: modifierPerUnit,
      lineDiscountCents: ZERO,
      lineTotalCents: gross,
    };
  });

  const subtotal = add(...priced.map((l) => l.lineTotalCents));

  // -- Discounts against food value ---------------------------------------
  const pointsDiscount = cents(ctx.pointsRedeemed * ctx.pointValueCents);
  const foodCoupon = ctx.couponAppliesToDeliveryFee
    ? ZERO
    : ctx.couponDiscountCents;
  const foodDiscount = cents(
    Math.min(subtotal, foodCoupon + pointsDiscount),
  );

  // Attribute the cart-level discount back onto lines so partial refunds and
  // the itemised receipt stay exact. `allocate` guarantees the parts sum to
  // the whole; naive per-line percentages do not.
  const allocated = allocate(
    foodDiscount,
    priced.map((l) => l.lineTotalCents),
  );
  allocated.forEach((amount, i) => {
    const line = priced[i];
    if (!line) return;
    line.lineDiscountCents = amount;
    line.lineTotalCents = subtract(line.lineTotalCents, amount);
  });

  const netFood = clampToZero(subtract(subtotal, foodDiscount));

  // -- Fees ----------------------------------------------------------------
  const freeDeliveryReached =
    ctx.freeDeliveryAboveCents !== null && netFood >= ctx.freeDeliveryAboveCents;

  const deliveryFee = ctx.couponAppliesToDeliveryFee
    ? ZERO
    : freeDeliveryReached
      ? ZERO
      : ctx.deliveryFeeCents;

  const serviceCharge = applyBps(netFood, ctx.serviceChargeBps);

  const taxableBase = add(netFood, ctx.packagingFeeCents, serviceCharge, deliveryFee);

  // -- Tax -----------------------------------------------------------------
  // GST-inclusive menus (the norm in Singapore) mean tax is already inside
  // the prices; we surface it on the receipt but do not add it on top.
  const tax = ctx.taxInclusive
    ? extractInclusiveTax(taxableBase, ctx.taxRateBps)
    : applyBps(taxableBase, ctx.taxRateBps);

  const total = add(
    ctx.taxInclusive ? taxableBase : add(taxableBase, tax),
    ctx.tipCents,
  );

  return {
    currency: ctx.currency,
    lines: priced,
    subtotalCents: subtotal,
    discountTotalCents: add(
      foodDiscount,
      ctx.couponAppliesToDeliveryFee ? ctx.deliveryFeeCents : ZERO,
    ),
    deliveryFeeCents: deliveryFee,
    packagingFeeCents: ctx.packagingFeeCents,
    serviceChargeCents: serviceCharge,
    taxCents: tax,
    tipCents: ctx.tipCents,
    totalCents: total,
    pointsRedeemed: ctx.pointsRedeemed,
    amountToFreeDeliveryCents:
      ctx.freeDeliveryAboveCents === null || freeDeliveryReached
        ? null
        : subtract(ctx.freeDeliveryAboveCents, netFood),
  };
};
