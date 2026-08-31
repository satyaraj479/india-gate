import type { CategorySlug, DietaryType, SpiceLevel } from "./catalog";

/**
 * Cart types.
 *
 * A cart line snapshots the dish name, image and prices at the moment it was
 * added. The cart is persisted to localStorage and can outlive a price change
 * or a dish being renamed; rendering it from a live catalog lookup would make
 * a guest's saved cart silently mutate overnight. Reconciliation against the
 * live menu happens explicitly at checkout, where the guest is shown what
 * changed — see `reconcileCart` in `lib/cart/reconcile.ts`.
 */

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaCents: number;
}

export interface CartItem {
  /**
   * Deterministic identity for a *configuration*, not an occurrence. Two adds
   * of "Masala Dosa, Medium, extra sambar" collapse into quantity 2; the same
   * dosa at Mild is a separate line. Derived by `buildLineId`, so the merge
   * happens without a scan-and-compare over selections in the reducer.
   */
  lineId: string;

  dishId: string;
  dishSlug: string;
  dishName: string;
  imageUrl: string | null;
  dietaryType: DietaryType;
  spiceLevel: SpiceLevel;
  /**
   * Carried on the line so category-scoped coupons ("S$10 off biryani") can be
   * evaluated without a catalog lookup. The cart is persisted and must remain
   * self-describing when the menu has not loaded yet.
   */
  categorySlug: CategorySlug;

  quantity: number;

  /** Snapshot. */
  unitBasePriceCents: number;
  selections: SelectedModifier[];
  specialInstructions: string | null;

  addedAt: string;
}

export type FulfilmentMode = "DELIVERY" | "TAKEAWAY";

export interface DeliveryLocation {
  postalCode: string;
  /** Resolved area name shown back to the guest as confirmation. */
  areaName: string;
  addressLine1: string;
  unitNumber: string | null;
  deliveryNotes: string | null;
  deliveryFeeCents: number;
  minOrderCents: number;
  freeDeliveryAboveCents: number | null;
  etaMinutes: number;
}

export interface AppliedCoupon {
  code: string;
  label: string;
  /** Computed against the current cart at apply time and on every reprice. */
  discountCents: number;
  appliesTo: "CART" | "DELIVERY_FEE";
}

/** Every line the order summary renders. Nothing here is computed in a view. */
export interface CartTotals {
  currency: string;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  packagingFeeCents: number;
  gstCents: number;
  totalCents: number;
  /** Null once the threshold is met, or when no threshold applies. */
  amountToFreeDeliveryCents: number | null;
  /** Gate Points this order would earn. */
  pointsToEarn: number;
}

/**
 * Stable line identity.
 *
 * Selections are sorted before hashing so that picking "Extra sambar" then
 * "Coconut chutney" produces the same line as the reverse order. Without the
 * sort, the cart grows a duplicate line for every permutation and the guest
 * sees the same dish three times.
 */
export const buildLineId = (
  dishId: string,
  selections: SelectedModifier[],
  specialInstructions: string | null,
): string => {
  const optionKey = selections
    .map((s) => s.optionId)
    .sort()
    .join(",");
  const notesKey = (specialInstructions ?? "").trim().toLowerCase();
  return `${dishId}::${optionKey}::${notesKey}`;
};

/** Per-unit price including modifiers. */
export const unitPriceCents = (item: CartItem): number =>
  item.unitBasePriceCents +
  item.selections.reduce((sum, s) => sum + s.priceDeltaCents, 0);

export const lineTotalCents = (item: CartItem): number =>
  unitPriceCents(item) * item.quantity;
