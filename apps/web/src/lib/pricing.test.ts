import { describe, expect, it } from "vitest";

import { calculateTotals } from "./pricing";
import { evaluateCoupon } from "./coupons";
import { checkServiceability } from "./serviceability";
import { buildLineId, lineTotalCents, unitPriceCents } from "@/types/cart";
import type { CartItem, DeliveryLocation } from "@/types/cart";

const line = (over: Partial<CartItem> = {}): CartItem => ({
  lineId: "l1",
  dishId: "dish-masala-dosa",
  dishSlug: "masala-dosa",
  dishName: "Masala Dosa",
  imageUrl: null,
  dietaryType: "VEG",
  spiceLevel: "MILD",
  categorySlug: "tiffins",
  quantity: 1,
  unitBasePriceCents: 890,
  selections: [],
  specialInstructions: null,
  addedAt: "2026-08-30T00:00:00.000Z",
  ...over,
});

const CENTRAL: DeliveryLocation = {
  postalCode: "238823",
  areaName: "Central & Orchard",
  addressLine1: "1 Orchard Turn",
  unitNumber: null,
  deliveryNotes: null,
  deliveryFeeCents: 499,
  minOrderCents: 2500,
  freeDeliveryAboveCents: 6000,
  etaMinutes: 45,
};

describe("line arithmetic", () => {
  it("adds modifier deltas into the unit price", () => {
    const item = line({
      selections: [
        {
          groupId: "mg-dosa-prep",
          groupName: "Preparation",
          optionId: "opt-prep-ghee",
          optionName: "Ghee roast",
          priceDeltaCents: 180,
        },
        {
          groupId: "mg-tiffin-extras",
          groupName: "Extras",
          optionId: "opt-extra-sambar",
          optionName: "Extra sambar",
          priceDeltaCents: 150,
        },
      ],
      quantity: 2,
    });

    expect(unitPriceCents(item)).toBe(890 + 180 + 150);
    expect(lineTotalCents(item)).toBe((890 + 180 + 150) * 2);
  });
});

describe("buildLineId", () => {
  it("is order-independent so permutations collapse into one line", () => {
    const a = buildLineId(
      "d1",
      [
        { groupId: "g", groupName: "G", optionId: "x", optionName: "X", priceDeltaCents: 0 },
        { groupId: "g", groupName: "G", optionId: "y", optionName: "Y", priceDeltaCents: 0 },
      ],
      null,
    );
    const b = buildLineId(
      "d1",
      [
        { groupId: "g", groupName: "G", optionId: "y", optionName: "Y", priceDeltaCents: 0 },
        { groupId: "g", groupName: "G", optionId: "x", optionName: "X", priceDeltaCents: 0 },
      ],
      null,
    );
    expect(a).toBe(b);
  });

  it("separates the same dish at different spice levels", () => {
    const mild = buildLineId(
      "d1",
      [{ groupId: "s", groupName: "Spice", optionId: "mild", optionName: "Mild", priceDeltaCents: 0 }],
      null,
    );
    const spicy = buildLineId(
      "d1",
      [{ groupId: "s", groupName: "Spice", optionId: "spicy", optionName: "Spicy", priceDeltaCents: 0 }],
      null,
    );
    expect(mild).not.toBe(spicy);
  });

  it("treats differing kitchen notes as separate lines", () => {
    expect(buildLineId("d1", [], "no curry leaves")).not.toBe(
      buildLineId("d1", [], null),
    );
  });
});

describe("calculateTotals", () => {
  it("extracts GST from inclusive prices instead of adding it on top", () => {
    // A single S$8.90 dosa, self-pickup, S$0.40 packaging = S$9.30 total.
    const totals = calculateTotals({
      items: [line()],
      fulfilmentMode: "TAKEAWAY",
      deliveryLocation: null,
      coupon: null,
    });

    expect(totals.subtotalCents).toBe(890);
    expect(totals.totalCents).toBe(930);
    // 930 × 9 / 109 = 76.8 → 77. Adding 9% on top would have given 1014.
    expect(totals.gstCents).toBe(77);
  });

  it("charges the zone delivery fee below the free-delivery threshold", () => {
    const totals = calculateTotals({
      items: [line({ quantity: 2 })],
      fulfilmentMode: "DELIVERY",
      deliveryLocation: CENTRAL,
      coupon: null,
    });

    expect(totals.subtotalCents).toBe(1780);
    expect(totals.deliveryFeeCents).toBe(499);
    expect(totals.totalCents).toBe(1780 + 499 + 60);
    expect(totals.amountToFreeDeliveryCents).toBe(6000 - 1780);
  });

  it("waives delivery once the threshold is met", () => {
    const totals = calculateTotals({
      items: [line({ quantity: 8 })], // 71.20
      fulfilmentMode: "DELIVERY",
      deliveryLocation: CENTRAL,
      coupon: null,
    });

    expect(totals.deliveryFeeCents).toBe(0);
    expect(totals.amountToFreeDeliveryCents).toBeNull();
  });

  it("applies a cart discount to food value, not to the delivery fee", () => {
    const totals = calculateTotals({
      items: [line({ quantity: 4 })], // 35.60
      fulfilmentMode: "DELIVERY",
      deliveryLocation: CENTRAL,
      coupon: {
        code: "GATE15",
        label: "15% off",
        discountCents: 534,
        appliesTo: "CART",
      },
    });

    expect(totals.discountCents).toBe(534);
    expect(totals.deliveryFeeCents).toBe(499);
    expect(totals.totalCents).toBe(3560 - 534 + 499 + 60);
  });

  it("zeroes the delivery fee for a free-delivery coupon", () => {
    const totals = calculateTotals({
      items: [line({ quantity: 4 })],
      fulfilmentMode: "DELIVERY",
      deliveryLocation: CENTRAL,
      coupon: {
        code: "FREEDEL",
        label: "Free delivery",
        discountCents: 499,
        appliesTo: "DELIVERY_FEE",
      },
    });

    expect(totals.deliveryFeeCents).toBe(0);
    expect(totals.totalCents).toBe(3560 + 60);
  });

  it("awards points on food value only, never on fees", () => {
    const totals = calculateTotals({
      items: [line({ quantity: 4 })], // S$35.60
      fulfilmentMode: "DELIVERY",
      deliveryLocation: CENTRAL,
      coupon: null,
    });
    // 35 whole dollars × 10, ignoring the 4.99 delivery and 0.60 packaging.
    expect(totals.pointsToEarn).toBe(356);
  });

  it("returns zeroes for an empty cart rather than NaN", () => {
    const totals = calculateTotals({
      items: [],
      fulfilmentMode: "TAKEAWAY",
      deliveryLocation: null,
      coupon: null,
    });
    expect(totals.subtotalCents).toBe(0);
    expect(totals.pointsToEarn).toBe(0);
  });
});

describe("evaluateCoupon", () => {
  const ctx = (over: Partial<Parameters<typeof evaluateCoupon>[1]> = {}) => ({
    items: [line({ quantity: 4 })],
    categoryByDishId: { "dish-masala-dosa": "tiffins" },
    subtotalCents: 3560,
    deliveryFeeCents: 499,
    fulfilmentMode: "DELIVERY" as const,
    now: new Date("2026-08-30T12:00:00.000Z"),
    ...over,
  });

  it("caps a percentage discount at its ceiling", () => {
    const result = evaluateCoupon("GATE15", ctx({ subtotalCents: 20000 }));
    expect(result.ok).toBe(true);
    // 15% of 200.00 is 30.00, but the cap is 8.00.
    if (result.ok) expect(result.coupon.discountCents).toBe(800);
  });

  it("is case-insensitive", () => {
    expect(evaluateCoupon("gate15", ctx()).ok).toBe(true);
  });

  it("says how much more is needed rather than just rejecting", () => {
    const result = evaluateCoupon("GATE15", ctx({ subtotalCents: 2380 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("MIN_ORDER_NOT_MET");
      expect(result.message).toContain("6.20");
    }
  });

  it("refuses a pickup-only code on a delivery order", () => {
    const result = evaluateCoupon("PICKUP5", ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CHANNEL_INELIGIBLE");
  });

  it("does not unlock a biryani-only code on a cart of tiffins", () => {
    // S$60 of dosai must not satisfy "S$10 off when you spend S$60 on
    // biryani". The rejection names the real problem — no eligible item —
    // rather than telling them to spend more, which they already have.
    const result = evaluateCoupon("DUM10", ctx({ subtotalCents: 6000 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_ELIGIBLE_ITEMS");
  });

  it("measures a category-scoped minimum against the eligible subset", () => {
    // S$60 in the cart, but only S$33.80 of it is biryani, so the S$60
    // biryani threshold is not met even though the cart total clears it.
    const result = evaluateCoupon(
      "DUM10",
      ctx({
        items: [
          line({ quantity: 3 }),
          line({
            lineId: "l2",
            dishId: "dish-chicken-biryani",
            dishName: "Hyderabadi Chicken Dum Biryani",
            categorySlug: "biryani",
            unitBasePriceCents: 1690,
            quantity: 2,
          }),
        ],
        categoryByDishId: {
          "dish-masala-dosa": "tiffins",
          "dish-chicken-biryani": "biryani",
        },
        subtotalCents: 6050,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MIN_ORDER_NOT_MET");
  });

  it("never discounts more than the cart is worth", () => {
    const result = evaluateCoupon(
      "DUM10",
      ctx({
        items: [line({ dishId: "dish-chicken-biryani", categorySlug: "biryani", quantity: 4 })],
        categoryByDishId: { "dish-chicken-biryani": "biryani" },
        subtotalCents: 600,
      }),
    );
    if (result.ok) expect(result.coupon.discountCents).toBeLessThanOrEqual(600);
  });

  it("rejects an unknown code", () => {
    const result = evaluateCoupon("NOTREAL", ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });
});

describe("checkServiceability", () => {
  it("resolves a Little India postcode to the core zone", () => {
    const result = checkServiceability("218123");
    expect(result.deliverable).toBe(true);
    if (result.deliverable) {
      expect(result.zone.id).toBe("zone-core");
      expect(result.zone.feeCents).toBe(299);
    }
  });

  it("strips spaces and non-digits before validating", () => {
    expect(checkServiceability(" 21 81 23 ").deliverable).toBe(true);
  });

  it("rejects a short postcode with a format error, not an out-of-range one", () => {
    const result = checkServiceability("2181");
    expect(result.deliverable).toBe(false);
    if (!result.deliverable) expect(result.reason).toBe("INVALID_FORMAT");
  });

  it("reports an unserved sector as out of range", () => {
    const result = checkServiceability("718123");
    expect(result.deliverable).toBe(false);
    if (!result.deliverable) expect(result.reason).toBe("OUT_OF_RANGE");
  });
});
