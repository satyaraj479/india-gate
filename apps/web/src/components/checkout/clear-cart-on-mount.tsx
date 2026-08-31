"use client";

import { useEffect } from "react";

import { useCartStore } from "@/store/cart-store";

/**
 * Empties the cart once the confirmation page is reached.
 *
 * Clearing at submit time is the obvious place and the wrong one: a card that
 * fails 3-D Secure, a closed tab mid-redirect or a declined payment would all
 * leave the guest with an empty cart and no order. Waiting until the
 * confirmation page renders means the cart survives every failure path and is
 * only discarded once there is definitely an order behind it.
 *
 * Renders nothing; it exists so the confirmation page itself can stay a server
 * component.
 */
export function ClearCartOnMount() {
  const clear = useCartStore((s) => s.clear);
  const closeCart = useCartStore((s) => s.closeCart);

  useEffect(() => {
    clear();
    closeCart();
  }, [clear, closeCart]);

  return null;
}
