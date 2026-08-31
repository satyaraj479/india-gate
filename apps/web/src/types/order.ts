import type { CartItem, CartTotals, FulfilmentMode } from "./cart";
import type { CustomerContact, DeliveryAddress } from "./customer";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_FAILED"
  | "PLACED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethodType =
  | "CARD"
  | "PAYNOW"
  | "GRABPAY"
  | "APPLE_PAY"
  | "GOOGLE_PAY"
  | "CASH_ON_DELIVERY";

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfilmentMode: FulfilmentMode;

  items: CartItem[];
  totals: CartTotals;

  contact: CustomerContact;
  deliveryAddress: DeliveryAddress | null;
  /** Shown at the counter for takeaway. */
  pickupCode: string | null;

  couponCode: string | null;
  orderNotes: string;

  scheduledFor: string | null;
  promisedReadyAt: string | null;
  estimatedArrivalAt: string | null;

  paymentMethodType: PaymentMethodType;
  paymentIntentId: string | null;

  placedAt: string;
}

/**
 * What the checkout route handler accepts.
 *
 * Note what is *absent*: any total. The client sends the cart configuration
 * and `expectedTotalCents` only as a cross-check — the server reprices from
 * the live catalog and refuses the order if the numbers disagree. A client
 * that could dictate the amount charged is a client that can be edited in
 * devtools.
 */
export interface CreateOrderRequest {
  fulfilmentMode: FulfilmentMode;
  items: Array<{
    dishId: string;
    quantity: number;
    optionIds: string[];
    specialInstructions: string | null;
  }>;
  contact: CustomerContact;
  deliveryAddress: DeliveryAddress | null;
  couponCode: string | null;
  orderNotes: string;
  scheduledFor: string | null;
  paymentMethodType: PaymentMethodType;
  expectedTotalCents: number;
}

/**
 * Provider-agnostic payment envelope. Clients branch on `action`, never on the
 * provider name — Stripe cards confirm on the client, PayNow redirects or
 * shows a QR, and a future Razorpay integration slots in without a component
 * change.
 */
export type PaymentAction =
  | "NONE"
  | "CONFIRM_ON_CLIENT"
  | "REDIRECT"
  | "DISPLAY_QR";

export interface PaymentIntentEnvelope {
  provider: "stripe" | "razorpay";
  paymentId: string;
  action: PaymentAction;
  clientSecret: string | null;
  redirectUrl: string | null;
  qrCodeData: string | null;
  amountCents: number;
  currency: string;
  /** Razorpay needs these on the client to open its checkout widget. */
  providerOrderId: string | null;
  publishableKey: string | null;
}

export interface CreateOrderResponse {
  order: Pick<Order, "id" | "orderNumber" | "status" | "totals">;
  payment: PaymentIntentEnvelope;
}

/** RFC 9457 problem document, as returned by every route handler on failure. */
export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Array<{ field: string; code: string; message: string }>;
  /** Present on `checkout/price-changed` so the UI can show the difference. */
  repricedTotals?: CartTotals;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_FAILED: "Payment failed",
  PLACED: "Order placed",
  CONFIRMED: "Confirmed by kitchen",
  PREPARING: "Being prepared",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
