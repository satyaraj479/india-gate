"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AppliedCoupon, CartItem, SelectedModifier } from "@/types/cart";
import { buildLineId, lineTotalCents } from "@/types/cart";
import type { CategorySlug, DietaryType, SpiceLevel } from "@/types/catalog";
import { evaluateCoupon, type CouponRejectionCode } from "@/lib/coupons";
import { useFulfilmentStore } from "./fulfilment-store";

/**
 * The cart.
 *
 * Persisted to localStorage so a guest who closes the tab mid-order comes back
 * to it. Three details make that survivable rather than a source of bugs:
 *
 *  1. Lines carry a *snapshot* of the dish — name, price, dietary marking. A
 *     persisted cart can outlive a price change, and rendering it from a live
 *     catalog lookup would make yesterday's cart silently change overnight.
 *     Reconciliation happens explicitly at checkout, where the guest is shown
 *     what moved.
 *  2. Line identity is derived from the *configuration* (`buildLineId`), so
 *     adding the same dosa twice increments a quantity instead of creating a
 *     second row, while the same dosa at a different spice level stays
 *     separate.
 *  3. The applied coupon is re-evaluated after every mutation. A code that was
 *     valid at S$62 must fall off when the guest removes a biryani and drops
 *     to S$44 — silently keeping the discount is how a cart total stops
 *     matching what the server will charge.
 */

export interface AddToCartInput {
  dishId: string;
  dishSlug: string;
  dishName: string;
  imageUrl: string | null;
  dietaryType: DietaryType;
  spiceLevel: SpiceLevel;
  categorySlug: CategorySlug;
  unitBasePriceCents: number;
  quantity: number;
  selections: SelectedModifier[];
  specialInstructions: string | null;
}

interface CartState {
  items: CartItem[];
  coupon: AppliedCoupon | null;
  couponError: { code: CouponRejectionCode; message: string } | null;

  /** Drawer visibility. Ephemeral — never persisted. */
  isOpen: boolean;
  /** Drives the "added" pulse on the cart badge. */
  lastAddedLineId: string | null;
  hasHydrated: boolean;

  addItem: (input: AddToCartInput) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;

  applyCoupon: (code: string) => { ok: boolean; message: string };
  removeCoupon: () => void;

  openCart: () => void;
  closeCart: () => void;
  setOpen: (open: boolean) => void;
  markHydrated: () => void;
}

const subtotalOf = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + lineTotalCents(item), 0);

const categoryMap = (items: CartItem[]): Record<string, string> =>
  Object.fromEntries(items.map((i) => [i.dishId, i.categorySlug]));

/**
 * Recompute the coupon against the cart as it now stands. A code whose
 * conditions no longer hold is dropped with an explanation rather than left in
 * place with a stale discount.
 */
const revalidate = (
  items: CartItem[],
  coupon: AppliedCoupon | null,
): Pick<CartState, "coupon" | "couponError"> => {
  if (!coupon) return { coupon: null, couponError: null };
  if (items.length === 0) return { coupon: null, couponError: null };

  const { mode, deliveryLocation } = useFulfilmentStore.getState();
  const result = evaluateCoupon(coupon.code, {
    items,
    categoryByDishId: categoryMap(items),
    subtotalCents: subtotalOf(items),
    deliveryFeeCents: deliveryLocation?.deliveryFeeCents ?? 0,
    fulfilmentMode: mode,
    now: new Date(),
  });

  return result.ok
    ? { coupon: result.coupon, couponError: null }
    : { coupon: null, couponError: { code: result.code, message: result.message } };
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      couponError: null,
      isOpen: false,
      lastAddedLineId: null,
      hasHydrated: false,

      addItem: (input) => {
        const lineId = buildLineId(
          input.dishId,
          input.selections,
          input.specialInstructions,
        );
        const existing = get().items.find((i) => i.lineId === lineId);

        const items = existing
          ? get().items.map((i) =>
              i.lineId === lineId
                ? { ...i, quantity: Math.min(99, i.quantity + input.quantity) }
                : i,
            )
          : [
              ...get().items,
              {
                lineId,
                dishId: input.dishId,
                dishSlug: input.dishSlug,
                dishName: input.dishName,
                imageUrl: input.imageUrl,
                dietaryType: input.dietaryType,
                spiceLevel: input.spiceLevel,
                categorySlug: input.categorySlug,
                quantity: Math.min(99, input.quantity),
                unitBasePriceCents: input.unitBasePriceCents,
                selections: input.selections,
                specialInstructions: input.specialInstructions,
                addedAt: new Date().toISOString(),
              } satisfies CartItem,
            ];

        set({ items, lastAddedLineId: lineId, ...revalidate(items, get().coupon) });
      },

      increment: (lineId) => {
        const items = get().items.map((i) =>
          i.lineId === lineId ? { ...i, quantity: Math.min(99, i.quantity + 1) } : i,
        );
        set({ items, ...revalidate(items, get().coupon) });
      },

      // Decrementing to zero removes the line. The alternative — a line stuck
      // at quantity 1 with a disabled minus button — makes guests hunt for a
      // separate delete control that is usually a 24px bin icon.
      decrement: (lineId) => {
        const items = get()
          .items.map((i) =>
            i.lineId === lineId ? { ...i, quantity: i.quantity - 1 } : i,
          )
          .filter((i) => i.quantity > 0);
        set({ items, ...revalidate(items, get().coupon) });
      },

      removeItem: (lineId) => {
        const items = get().items.filter((i) => i.lineId !== lineId);
        set({ items, ...revalidate(items, get().coupon) });
      },

      setQuantity: (lineId, quantity) => {
        const clamped = Math.max(0, Math.min(99, Math.trunc(quantity)));
        const items = get()
          .items.map((i) => (i.lineId === lineId ? { ...i, quantity: clamped } : i))
          .filter((i) => i.quantity > 0);
        set({ items, ...revalidate(items, get().coupon) });
      },

      clear: () =>
        set({ items: [], coupon: null, couponError: null, lastAddedLineId: null }),

      applyCoupon: (code) => {
        const { items } = get();
        if (items.length === 0) {
          const message = "Add something to your cart first.";
          set({ couponError: { code: "NO_ELIGIBLE_ITEMS", message } });
          return { ok: false, message };
        }

        const { mode, deliveryLocation } = useFulfilmentStore.getState();
        const result = evaluateCoupon(code, {
          items,
          categoryByDishId: categoryMap(items),
          subtotalCents: subtotalOf(items),
          deliveryFeeCents: deliveryLocation?.deliveryFeeCents ?? 0,
          fulfilmentMode: mode,
          now: new Date(),
        });

        if (!result.ok) {
          set({ coupon: null, couponError: { code: result.code, message: result.message } });
          return { ok: false, message: result.message };
        }

        set({ coupon: result.coupon, couponError: null });
        return { ok: true, message: result.coupon.label };
      },

      removeCoupon: () => set({ coupon: null, couponError: null }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false, lastAddedLineId: null }),
      setOpen: (open) => set({ isOpen: open }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "indiagate.cart.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, coupon: state.coupon }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.markHydrated();
        // A cart restored from storage may have been priced against a coupon
        // whose conditions no longer hold — or against yesterday's delivery
        // mode. Re-run the rules once, on load, before anything renders a total.
        const { coupon, couponError } = revalidate(state.items, state.coupon);
        useCartStore.setState({ coupon, couponError });
      },
    },
  ),
);

// -- Selectors ---------------------------------------------------------------
// Exported as standalone functions so components subscribe to a slice rather
// than the whole store. `useCartStore((s) => s.items.length)` re-renders on
// every quantity change; these do not.

export const selectItemCount = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectSubtotalCents = (state: CartState): number =>
  subtotalOf(state.items);

export const selectIsEmpty = (state: CartState): boolean =>
  state.items.length === 0;
