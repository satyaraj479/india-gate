import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  PaymentConfigurationError,
  type CreatePaymentInput,
  type PaymentProvider,
  type WebhookVerification,
} from "./provider";
import type { PaymentIntentEnvelope } from "@/types/order";

/**
 * Razorpay adapter.
 *
 * Present because the same restaurant group operates in India, where Razorpay
 * (UPI, netbanking, wallets) is the default and Stripe is not an option. It is
 * implemented against Razorpay's REST API directly rather than through their
 * SDK — the SDK is a thin wrapper with no types worth the dependency, and the
 * Orders API is two endpoints.
 *
 * Switch with `PAYMENT_PROVIDER=razorpay`. Nothing outside this file changes.
 */

const API_BASE = "https://api.razorpay.com/v1";

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

const credentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new PaymentConfigurationError(
      "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be set.",
    );
  }
  return { keyId, keySecret };
};

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "razorpay" as const;

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntentEnvelope> {
    const { keyId, keySecret } = credentials();

    const response = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        // Razorpay's own idempotency header, so a retried checkout reuses the
        // original order rather than creating a second one.
        "X-Razorpay-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        // Razorpay caps this at 40 characters and rejects longer values.
        receipt: input.orderNumber.slice(0, 40),
        notes: {
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          customerPhone: input.customer.phone,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Razorpay order creation failed (${response.status}): ${detail}`);
    }

    const order = (await response.json()) as RazorpayOrder;

    return {
      provider: "razorpay",
      paymentId: order.id,
      // Razorpay opens its own hosted widget over the page, keyed by the
      // order id — hence REDIRECT rather than CONFIRM_ON_CLIENT.
      action: "REDIRECT",
      clientSecret: null,
      redirectUrl: input.returnUrl,
      qrCodeData: null,
      amountCents: order.amount,
      currency: order.currency,
      providerOrderId: order.id,
      publishableKey: keyId,
    };
  }

  async verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<WebhookVerification> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new PaymentConfigurationError("RAZORPAY_WEBHOOK_SECRET is not set.");
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");

    // Length check first: timingSafeEqual throws on a length mismatch, and
    // that throw is itself a timing signal.
    if (
      received.length !== expected.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new Error("Razorpay webhook signature verification failed");
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload: {
        payment?: {
          entity: {
            id: string;
            amount: number;
            error_description?: string;
            notes?: Record<string, string>;
          };
        };
      };
    };

    const payment = event.payload.payment?.entity;

    switch (event.event) {
      case "payment.captured":
        return {
          eventId: `${event.event}:${payment?.id ?? ""}`,
          eventType: event.event,
          paymentId: payment?.id ?? "",
          orderId: payment?.notes?.orderId ?? null,
          status: "SUCCEEDED",
          amountCents: payment?.amount ?? null,
          failureMessage: null,
        };
      case "payment.failed":
        return {
          eventId: `${event.event}:${payment?.id ?? ""}`,
          eventType: event.event,
          paymentId: payment?.id ?? "",
          orderId: payment?.notes?.orderId ?? null,
          status: "FAILED",
          amountCents: payment?.amount ?? null,
          failureMessage: payment?.error_description ?? "The payment was declined.",
        };
      default:
        return {
          eventId: `${event.event}:${payment?.id ?? ""}`,
          eventType: event.event,
          paymentId: payment?.id ?? "",
          orderId: null,
          status: "IGNORED",
          amountCents: null,
          failureMessage: null,
        };
    }
  }
}
