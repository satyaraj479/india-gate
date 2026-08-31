import type { PaymentIntentEnvelope, PaymentMethodType } from "@/types/order";

/**
 * The payment seam.
 *
 * Every gateway is reached through this interface, and no component or route
 * handler imports a provider SDK directly. Two reasons this earns its keep
 * rather than being premature abstraction:
 *
 *  1. Singapore needs PayNow and GrabPay alongside cards, and those have
 *     genuinely different client flows — confirm-on-client, redirect, QR. The
 *     envelope's `action` field is what the UI branches on, so adding a method
 *     never touches a component.
 *  2. Restaurants change acquirers. Moving from Stripe to Razorpay because the
 *     owner's bank changed should be a new file and an environment variable,
 *     not a rewrite of the checkout.
 */
export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  methodType: PaymentMethodType;
  customer: { name: string; email: string; phone: string };
  /** Deep link the gateway returns to after a redirect or 3-D Secure step. */
  returnUrl: string;
  /**
   * Passed to the gateway so a retried request cannot create a second charge.
   * Both Stripe and Razorpay honour this natively.
   */
  idempotencyKey: string;
}

export interface WebhookVerification {
  eventId: string;
  eventType: string;
  paymentId: string;
  orderId: string | null;
  status: "SUCCEEDED" | "FAILED" | "PENDING" | "IGNORED";
  amountCents: number | null;
  failureMessage: string | null;
}

export interface PaymentProvider {
  readonly name: "stripe" | "razorpay";

  createPayment(input: CreatePaymentInput): Promise<PaymentIntentEnvelope>;

  /**
   * Verifies the signature and normalises the payload. Throws on a bad
   * signature — the route handler must answer 400 rather than trusting it.
   */
  verifyWebhook(rawBody: string, signature: string): Promise<WebhookVerification>;
}

export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}
