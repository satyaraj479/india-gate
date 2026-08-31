import { cents, format, priceCart } from "@indiagate/core";

import type {
  AppliedCoupon,
  CartItem,
  CartTotals,
  DeliveryLocation,
  FulfilmentMode,
} from "@/types/cart";
import {
  CURRENCY,
  GST_RATE_BPS,
  LOCALE,
  PACKAGING_FEE_CENTS,
  POINTS_PER_DOLLAR,
  PRICES_INCLUDE_GST,
  TAKEAWAY_PACKAGING_FEE_CENTS,
} from "./config";

/**
 * Cart totals.
 *
 * The arithmetic itself lives in `@indiagate/core`, shared with the API and
 * the mobile app, so the number in this drawer, the number on the payment
 * sheet and the number the kitchen is paid are computed by the same function.
 * This module is the adapter: it maps web cart lines onto that function's
 * inputs and its output onto what the summary component renders.
 *
 * Nothing in a view computes a total. If you find yourself writing
 * `items.reduce(...)` inside a component, it belongs here.
 */

export interface PricingInput {
  items: CartItem[];
  fulfilmentMode: FulfilmentMode;
  deliveryLocation: DeliveryLocation | null;
  coupon: AppliedCoupon | null;
}

export const calculateTotals = ({
  items,
  fulfilmentMode,
  deliveryLocation,
  coupon,
}: PricingInput): CartTotals => {
  const isDelivery = fulfilmentMode === "DELIVERY";

  const result = priceCart(
    items.map((item) => ({
      id: item.lineId,
      quantity: item.quantity,
      unitPriceCents: cents(item.unitBasePriceCents),
      modifiers: item.selections.map((s) => ({
        priceDeltaCents: cents(s.priceDeltaCents),
        quantity: 1,
      })),
    })),
    {
      currency: CURRENCY,
      taxRateBps: GST_RATE_BPS,
      taxInclusive: PRICES_INCLUDE_GST,
      packagingFeeCents: cents(
        isDelivery ? PACKAGING_FEE_CENTS : TAKEAWAY_PACKAGING_FEE_CENTS,
      ),
      // No service charge on delivery or takeaway; it applies to dine-in only.
      serviceChargeBps: 0,
      deliveryFeeCents: cents(
        isDelivery ? (deliveryLocation?.deliveryFeeCents ?? 0) : 0,
      ),
      freeDeliveryAboveCents:
        isDelivery && deliveryLocation?.freeDeliveryAboveCents != null
          ? cents(deliveryLocation.freeDeliveryAboveCents)
          : null,
      tipCents: cents(0),
      couponDiscountCents: cents(coupon?.discountCents ?? 0),
      couponAppliesToDeliveryFee: coupon?.appliesTo === "DELIVERY_FEE",
      pointsRedeemed: 0,
      pointValueCents: 1,
    },
  );

  // Points accrue on food value after discount — never on delivery, packaging
  // or tax. Awarding points on a fee is how a loyalty programme quietly turns
  // into a liability.
  const eligibleForPoints = Math.max(
    0,
    result.subtotalCents - result.discountTotalCents,
  );
  const pointsToEarn = Math.floor((eligibleForPoints / 100) * POINTS_PER_DOLLAR);

  return {
    currency: result.currency,
    subtotalCents: result.subtotalCents,
    discountCents: result.discountTotalCents,
    deliveryFeeCents: result.deliveryFeeCents,
    packagingFeeCents: result.packagingFeeCents,
    gstCents: result.taxCents,
    totalCents: result.totalCents,
    amountToFreeDeliveryCents: result.amountToFreeDeliveryCents,
    pointsToEarn,
  };
};

/** The one place a cent value becomes a string. */
export const formatMoney = (value: number): string =>
  format(cents(Math.round(value)), CURRENCY, LOCALE);

export const EMPTY_TOTALS: CartTotals = {
  currency: CURRENCY,
  subtotalCents: 0,
  discountCents: 0,
  deliveryFeeCents: 0,
  packagingFeeCents: 0,
  gstCents: 0,
  totalCents: 0,
  amountToFreeDeliveryCents: null,
  pointsToEarn: 0,
};
