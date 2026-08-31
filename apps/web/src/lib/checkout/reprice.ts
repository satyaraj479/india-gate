import "server-only";

import { getMenuRepository } from "@/lib/catalog/repository";
import { evaluateCoupon } from "@/lib/coupons";
import { calculateTotals } from "@/lib/pricing";
import { checkServiceability } from "@/lib/serviceability";
import { buildLineId, type CartItem, type CartTotals, type FulfilmentMode } from "@/types/cart";
import { buildMenuIndex, resolveModifierGroups } from "@/types/catalog";
import type { CreateOrderRequest } from "@/types/order";

/**
 * Server-side repricing.
 *
 * This is the security boundary of the whole checkout. The client sends a
 * *configuration* — dish ids, option ids, quantities — and nothing else that
 * touches money. Prices, modifier deltas, the delivery fee, the coupon and the
 * tax are all resolved here from the catalog the server controls.
 *
 * `expectedTotalCents` from the client is used only as a cross-check: if it
 * disagrees with what we compute, the order is refused with
 * `checkout/price-changed` and the guest re-confirms. It is never used to
 * decide what to charge. A client that can dictate the amount is a client that
 * can be edited in devtools.
 */

export type RepriceResult =
  | { ok: true; items: CartItem[]; totals: CartTotals }
  | {
      ok: false;
      type: string;
      title: string;
      status: number;
      detail: string;
      repricedTotals?: CartTotals;
    };

export const repriceOrder = async (
  request: CreateOrderRequest,
): Promise<RepriceResult> => {
  const menu = await getMenuRepository().getMenu();
  const index = buildMenuIndex(menu);

  if (request.items.length === 0) {
    return {
      ok: false,
      type: "checkout/empty-cart",
      title: "Your cart is empty",
      status: 422,
      detail: "Add at least one dish before checking out.",
    };
  }

  const items: CartItem[] = [];

  for (const line of request.items) {
    const dish = index.dishById.get(line.dishId);

    if (!dish) {
      return {
        ok: false,
        type: "checkout/item-not-found",
        title: "An item is no longer on the menu",
        status: 409,
        detail: "One of the dishes in your cart has been removed. Please review your order.",
      };
    }

    if (!dish.isAvailable) {
      return {
        ok: false,
        type: "checkout/item-unavailable",
        title: `${dish.name} has sold out`,
        status: 409,
        detail:
          dish.unavailableUntilLabel ??
          `${dish.name} is no longer available today. Please remove it to continue.`,
      };
    }

    // Re-validate the selections against the dish's *current* modifier groups.
    // A client could otherwise post an option id belonging to another dish and
    // pay that dish's cheaper delta.
    const groups = resolveModifierGroups(dish, index);
    const selections = [];

    for (const optionId of line.optionIds) {
      const group = groups.find((g) => g.options.some((o) => o.id === optionId));
      const option = group?.options.find((o) => o.id === optionId);

      if (!group || !option || !option.isAvailable) {
        return {
          ok: false,
          type: "checkout/invalid-modifier",
          title: "An option is no longer available",
          status: 409,
          detail: `A choice on ${dish.name} is no longer offered. Please re-customise it.`,
        };
      }

      selections.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDeltaCents: option.priceDeltaCents,
      });
    }

    // Required groups and selection caps are enforced here too, not only in
    // the dialog — the dialog is a convenience, this is the rule.
    for (const group of groups) {
      const chosen = selections.filter((s) => s.groupId === group.id).length;
      if (group.isRequired && chosen < group.minSelections) {
        return {
          ok: false,
          type: "checkout/incomplete-customisation",
          title: `${dish.name} needs a choice`,
          status: 422,
          detail: `Please choose ${group.name.toLowerCase()} for ${dish.name}.`,
        };
      }
      if (chosen > group.maxSelections) {
        return {
          ok: false,
          type: "checkout/too-many-selections",
          title: `Too many options on ${dish.name}`,
          status: 422,
          detail: `${group.name} allows at most ${group.maxSelections}.`,
        };
      }
    }

    items.push({
      lineId: buildLineId(dish.id, selections, line.specialInstructions),
      dishId: dish.id,
      dishSlug: dish.slug,
      dishName: dish.name,
      imageUrl: dish.imageUrl,
      dietaryType: dish.dietaryType,
      spiceLevel: dish.spiceLevel,
      categorySlug: dish.categorySlug,
      quantity: Math.max(1, Math.min(99, line.quantity)),
      unitBasePriceCents: dish.basePriceCents,
      selections,
      specialInstructions: line.specialInstructions,
      addedAt: new Date().toISOString(),
    });
  }

  // -- Fulfilment ----------------------------------------------------------
  const mode: FulfilmentMode = request.fulfilmentMode;
  let deliveryLocation = null;

  if (mode === "DELIVERY") {
    if (!request.deliveryAddress) {
      return {
        ok: false,
        type: "checkout/address-required",
        title: "A delivery address is required",
        status: 422,
        detail: "Add a delivery address, or switch to self-pickup.",
      };
    }

    const service = checkServiceability(request.deliveryAddress.postalCode);
    if (!service.deliverable) {
      return {
        ok: false,
        type: "checkout/not-serviceable",
        title: "We do not deliver there",
        status: 422,
        detail: service.message,
      };
    }

    deliveryLocation = {
      postalCode: service.postalCode,
      areaName: service.zone.name,
      addressLine1: request.deliveryAddress.addressLine1,
      unitNumber: request.deliveryAddress.unitNumber || null,
      deliveryNotes: request.deliveryAddress.deliveryNotes || null,
      deliveryFeeCents: service.zone.feeCents,
      minOrderCents: service.zone.minOrderCents,
      freeDeliveryAboveCents: service.zone.freeDeliveryAboveCents,
      etaMinutes: service.zone.etaMinutes,
    };
  }

  // -- Coupon --------------------------------------------------------------
  const subtotalCents = items.reduce(
    (sum, item) =>
      sum +
      (item.unitBasePriceCents +
        item.selections.reduce((s, m) => s + m.priceDeltaCents, 0)) *
        item.quantity,
    0,
  );

  let coupon = null;
  if (request.couponCode) {
    const evaluation = evaluateCoupon(request.couponCode, {
      items,
      categoryByDishId: Object.fromEntries(
        items.map((i) => [i.dishId, i.categorySlug]),
      ),
      subtotalCents,
      deliveryFeeCents: deliveryLocation?.deliveryFeeCents ?? 0,
      fulfilmentMode: mode,
      now: new Date(),
    });

    if (!evaluation.ok) {
      return {
        ok: false,
        type: "checkout/coupon-invalid",
        title: "That promo code no longer applies",
        status: 422,
        detail: evaluation.message,
      };
    }
    coupon = evaluation.coupon;
  }

  const totals = calculateTotals({
    items,
    fulfilmentMode: mode,
    deliveryLocation,
    coupon,
  });

  if (
    mode === "DELIVERY" &&
    deliveryLocation &&
    totals.subtotalCents < deliveryLocation.minOrderCents
  ) {
    return {
      ok: false,
      type: "checkout/below-minimum",
      title: "Below the delivery minimum",
      status: 422,
      detail: `Delivery to ${deliveryLocation.areaName} starts at S$${(
        deliveryLocation.minOrderCents / 100
      ).toFixed(2)}.`,
      repricedTotals: totals,
    };
  }

  if (totals.totalCents !== request.expectedTotalCents) {
    return {
      ok: false,
      type: "checkout/price-changed",
      title: "The total has changed",
      status: 409,
      detail:
        "Prices or availability changed while you were checking out. Please review the updated total before paying.",
      repricedTotals: totals,
    };
  }

  return { ok: true, items, totals };
};
