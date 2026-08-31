import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import type { DietaryType } from "@/types/catalog";
import type { CartTotals, FulfilmentMode } from "@/types/cart";
import { lineTotalCents } from "@/types/cart";
import type { Order, OrderStatus } from "@/types/order";

/**
 * The receipt the confirmation page renders, and a signed-cookie carrier for it.
 *
 * WHY THIS EXISTS. `OrderStore` keeps orders in a module-level Map. That is
 * fine on one long-lived server — the laptop, or a container — but on a
 * serverless platform the checkout POST and the subsequent confirmation GET
 * are two separate invocations that may land on different instances. The
 * confirmation page then finds nothing and 404s: the guest pays and is told
 * their order does not exist. It is invisible in local development and
 * reproduces immediately on Vercel.
 *
 * The fix here is deliberately the small one. The checkout route stamps a
 * compact, signed copy of the receipt into an httpOnly cookie; the
 * confirmation page reads the store first and falls back to that cookie. It
 * survives the redirect back from Stripe, needs no external service, and
 * disappears in two hours.
 *
 * This is a demo affordance, not a design. The real fix is a database — swap
 * `InMemoryOrderStore` for the platform API and this fallback becomes dead
 * code you can delete.
 *
 * On signing: the cookie is written and read by this app alone, so a forged
 * one grants nothing — no money moves, no other guest's data is exposed. It is
 * signed anyway so that a hand-crafted cookie cannot render a plausible
 * "receipt" page to screenshot as proof of an order that was never placed.
 * Tamper-evidence, not an authorisation boundary.
 */

export interface ReceiptLine {
  name: string;
  quantity: number;
  dietaryType: DietaryType;
  options: string[];
  note: string | null;
  lineTotalCents: number;
}

export interface Receipt {
  orderNumber: string;
  status: OrderStatus;
  fulfilmentMode: FulfilmentMode;
  firstName: string;
  email: string;
  pickupCode: string | null;
  couponCode: string | null;
  addressLine1: string | null;
  unitNumber: string | null;
  postalCode: string | null;
  promisedReadyAt: string | null;
  estimatedArrivalAt: string | null;
  totals: CartTotals;
  lines: ReceiptLine[];
  /** True when the item list was dropped to keep the cookie under 4 KB. */
  truncated: boolean;
}

export const toReceipt = (order: Order): Receipt => ({
  orderNumber: order.orderNumber,
  status: order.status,
  fulfilmentMode: order.fulfilmentMode,
  firstName: order.contact.firstName,
  email: order.contact.email,
  pickupCode: order.pickupCode,
  couponCode: order.couponCode,
  addressLine1: order.deliveryAddress?.addressLine1 ?? null,
  unitNumber: order.deliveryAddress?.unitNumber || null,
  postalCode: order.deliveryAddress?.postalCode ?? null,
  promisedReadyAt: order.promisedReadyAt,
  estimatedArrivalAt: order.estimatedArrivalAt,
  totals: order.totals,
  lines: order.items.map((item) => ({
    name: item.dishName,
    quantity: item.quantity,
    dietaryType: item.dietaryType,
    options: item.selections.map((s) => s.optionName),
    note: item.specialInstructions,
    lineTotalCents: lineTotalCents(item),
  })),
  truncated: false,
});

const COOKIE_NAME = "ig_receipt";
const MAX_AGE_SECONDS = 2 * 60 * 60;
/** Browsers drop a cookie over 4096 bytes silently, which is the worst failure. */
const MAX_COOKIE_BYTES = 3800;

const signingKey = (): string =>
  process.env.RECEIPT_SECRET ??
  process.env.STRIPE_SECRET_KEY ??
  // Development only. In production either RECEIPT_SECRET or a Stripe key is
  // set, and a fixed fallback there would make the signature meaningless.
  "india-gate-dev-receipt-key";

const sign = (payload: string): string =>
  createHmac("sha256", signingKey()).update(payload).digest("base64url");

const verify = (payload: string, signature: string): boolean => {
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  // Length check first: timingSafeEqual throws on a mismatch, and that throw
  // is itself a timing signal.
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
};

const encode = (receipt: Receipt): string => {
  const body = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  return `${body}.${sign(body)}`;
};

export const setReceiptCookie = (order: Order): void => {
  let receipt = toReceipt(order);
  let value = encode(receipt);

  // A twenty-line order blows the cookie budget. Rather than let the browser
  // drop it silently and 404 the guest, shed the item detail and keep the
  // header and totals — a receipt without a line list still tells them the
  // order landed and what they paid.
  if (Buffer.byteLength(value) > MAX_COOKIE_BYTES) {
    receipt = { ...receipt, lines: [], truncated: true };
    value = encode(receipt);
  }

  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` rather than `strict`: the guest returns from Stripe's domain by a
    // top-level navigation, and `strict` would withhold the cookie on exactly
    // that request.
    sameSite: "lax",
    path: "/checkout/confirmation",
    maxAge: MAX_AGE_SECONDS,
  });
};

export const readReceiptCookie = (orderNumber: string): Receipt | null => {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!verify(body, signature)) return null;

  try {
    const receipt = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Receipt;
    // The cookie holds the most recent order only. Someone opening an older
    // confirmation URL must not be shown a different order's receipt.
    return receipt.orderNumber === orderNumber ? receipt : null;
  } catch {
    return null;
  }
};
