"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { DeliveryLocation, FulfilmentMode } from "@/types/cart";
import { checkServiceability, type DeliveryZone } from "@/lib/serviceability";

/**
 * Delivery-versus-takeaway, and where we are delivering to.
 *
 * Kept separate from the cart because it has a different lifetime: a guest's
 * address survives them emptying the cart, and switching to takeaway must not
 * discard the address they entered. Merging the two stores means every
 * `clearCart()` has to remember not to clear the address, and eventually one
 * of them forgets.
 */

interface FulfilmentState {
  mode: FulfilmentMode;
  deliveryLocation: DeliveryLocation | null;
  /** Drives the address modal from anywhere — header, cart, checkout. */
  isValidatorOpen: boolean;
  /**
   * False during the server render and the first client paint. Components read
   * it before rendering anything derived from persisted state; see
   * `useHydrated`.
   */
  hasHydrated: boolean;

  setMode: (mode: FulfilmentMode) => void;
  openValidator: () => void;
  closeValidator: () => void;
  /** Returns the result so the modal can render the rejection message. */
  validateAndSetPostcode: (raw: string) => ReturnType<typeof checkServiceability>;
  completeAddress: (details: {
    addressLine1: string;
    unitNumber: string | null;
    deliveryNotes: string | null;
  }) => void;
  clearDeliveryLocation: () => void;
  markHydrated: () => void;
}

const toLocation = (
  zone: DeliveryZone,
  postalCode: string,
  previous: DeliveryLocation | null,
): DeliveryLocation => {
  // Preserve what the guest already typed when they only corrected a typo in
  // the postcode; re-asking for an address they just entered is infuriating.
  const keepDetails = previous?.postalCode === postalCode;
  return {
    postalCode,
    areaName: zone.name,
    addressLine1: keepDetails ? previous.addressLine1 : "",
    unitNumber: keepDetails ? previous.unitNumber : null,
    deliveryNotes: keepDetails ? previous.deliveryNotes : null,
    deliveryFeeCents: zone.feeCents,
    minOrderCents: zone.minOrderCents,
    freeDeliveryAboveCents: zone.freeDeliveryAboveCents,
    etaMinutes: zone.etaMinutes,
  };
};

export const useFulfilmentStore = create<FulfilmentState>()(
  persist(
    (set, get) => ({
      mode: "DELIVERY",
      deliveryLocation: null,
      isValidatorOpen: false,
      hasHydrated: false,

      setMode: (mode) => {
        set({ mode });
        // Switching to delivery without a known address is the one case where
        // the modal opens on its own: the guest cannot see a fee or an ETA
        // until we know where they are.
        if (mode === "DELIVERY" && !get().deliveryLocation) {
          set({ isValidatorOpen: true });
        }
      },

      openValidator: () => set({ isValidatorOpen: true }),
      closeValidator: () => set({ isValidatorOpen: false }),

      validateAndSetPostcode: (raw) => {
        const result = checkServiceability(raw);
        if (result.deliverable) {
          set({
            deliveryLocation: toLocation(
              result.zone,
              result.postalCode,
              get().deliveryLocation,
            ),
            mode: "DELIVERY",
          });
        }
        return result;
      },

      completeAddress: ({ addressLine1, unitNumber, deliveryNotes }) => {
        const current = get().deliveryLocation;
        if (!current) return;
        set({
          deliveryLocation: { ...current, addressLine1, unitNumber, deliveryNotes },
          isValidatorOpen: false,
        });
      },

      clearDeliveryLocation: () => set({ deliveryLocation: null }),

      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "indiagate.fulfilment.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // `isValidatorOpen` and `hasHydrated` are ephemeral. Persisting the
      // former means the modal reopens on every page load — exactly the kind
      // of detail that survives review and annoys users for months.
      partialize: (state) => ({
        mode: state.mode,
        deliveryLocation: state.deliveryLocation,
      }),
      onRehydrateStorage: () => (state) => state?.markHydrated(),
    },
  ),
);
