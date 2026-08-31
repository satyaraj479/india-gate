"use client";

import { useMemo } from "react";

import { useCartStore } from "@/store/cart-store";
import { useFulfilmentStore } from "@/store/fulfilment-store";
import { calculateTotals } from "@/lib/pricing";
import type { CartTotals } from "@/types/cart";

/**
 * The single source of the numbers rendered anywhere in the UI.
 *
 * Memoised on the inputs that actually affect the total, so typing in the
 * delivery-notes field does not re-run the pricing engine.
 */
export function useCartTotals(): CartTotals {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const mode = useFulfilmentStore((s) => s.mode);
  const deliveryLocation = useFulfilmentStore((s) => s.deliveryLocation);

  return useMemo(
    () =>
      calculateTotals({
        items,
        fulfilmentMode: mode,
        deliveryLocation,
        coupon,
      }),
    [items, mode, deliveryLocation, coupon],
  );
}
