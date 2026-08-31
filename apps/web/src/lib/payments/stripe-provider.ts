import "server-only";

import Stripe from "stripe";

import {
  PaymentConfigurationError,
  type CreatePaymentInput,
  type PaymentProvider,
  type WebhookVerification,
} from "./provider";
import type { PaymentIntentEnvelope, PaymentMethodType } from "@/types/order";

/**
 * Stripe adapter.
 *
 * PaymentIntents rather than Checkout Sessions: the guest stays on our page,
 * which matters because the cart, the loyalty preview and the pickup-versus-
 * delivery context are all part of the decision to pay. Redirecting to a
 * hosted page loses that and measurably costs conversions on mobile.
 */

const METHOD_MAP: Partial<Record<PaymentMethodType, string>> = {
  CARD: "card",
  PAYNOW: "paynow",
  GRABPAY: "grabpay",
  // Apple Pay and Google Pay are surfaced through the card method by Stripe's
  // Payment Element; they are not separate payment_method_types.
  APPLE_PAY: "card",
  GOOGLE_PAY: "card",
};

let client: Stripe | null = null;

const getStripe = (): Stripe => {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new PaymentConfigurationError(
      "STRIPE_SECRET_KEY is not set. Copy .env.example to .env.local and add your test keys.",
    );
  }

  client = new Stripe(key, {
    // Pinned so a Stripe-side API upgrade cannot change behaviour under us.
    // The cast keeps this compiling across SDK minor versions, which narrow
    // the literal union each time they ship a new version.
    apiVersion: "2024-11-20.acacia" as Stripe.StripeConfig["apiVersion"],
    typescript: true,
    appInfo: { name: "India Gate Web", version: "1.0.0" },
    maxNetworkRetries: 2,
  });
  return client;
};

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntentEnvelope> {
    const stripe = getStripe();
    const method = METHOD_MAP[input.methodType];

    if (!method) {
      throw new PaymentConfigurationError(
        `${input.methodType} is not available through Stripe.`,
      );
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        payment_method_types: [method],
        // The order number, not the internal id, so the ops team can match a
        // Stripe row to a kitchen ticket without a database lookup.
        description: `India Gate order ${input.orderNumber}`,
        receipt_email: input.customer.email,
        metadata: {
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          customerPhone: input.customer.phone,
        },
        // Statement descriptors have a 22-character ceiling and Stripe rejects
        // the whole request if it is exceeded.
        statement_descriptor_suffix: input.orderNumber.slice(0, 22),
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (!intent.client_secret) {
      throw new Error("Stripe returned a PaymentIntent without a client secret");
    }

    return {
      provider: "stripe",
      paymentId: intent.id,
      // PayNow renders a QR the guest scans in their banking app; cards and
      // wallets confirm inline through the Payment Element.
      action: method === "paynow" ? "DISPLAY_QR" : "CONFIRM_ON_CLIENT",
      clientSecret: intent.client_secret,
      redirectUrl: null,
      qrCodeData: null,
      amountCents: intent.amount,
      currency: intent.currency.toUpperCase(),
      providerOrderId: null,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    };
  }

  async verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<WebhookVerification> {
    const stripe = getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new PaymentConfigurationError("STRIPE_WEBHOOK_SECRET is not set.");
    }

    // Throws on a bad signature. The caller turns that into a 400 — never a
    // 500, which would make Stripe retry a forged request forever.
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        return {
          eventId: event.id,
          eventType: event.type,
          paymentId: intent.id,
          orderId: intent.metadata.orderId ?? null,
          status: "SUCCEEDED",
          amountCents: intent.amount_received,
          failureMessage: null,
        };
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        return {
          eventId: event.id,
          eventType: event.type,
          paymentId: intent.id,
          orderId: intent.metadata.orderId ?? null,
          status: "FAILED",
          amountCents: intent.amount,
          failureMessage:
            intent.last_payment_error?.message ?? "The payment was declined.",
        };
      }
      case "payment_intent.processing": {
        const intent = event.data.object;
        return {
          eventId: event.id,
          eventType: event.type,
          paymentId: intent.id,
          orderId: intent.metadata.orderId ?? null,
          status: "PENDING",
          amountCents: intent.amount,
          failureMessage: null,
        };
      }
      default:
        // Acknowledged and ignored. Answering anything but 2xx makes Stripe
        // retry events we never asked for.
        return {
          eventId: event.id,
          eventType: event.type,
          paymentId: "",
          orderId: null,
          status: "IGNORED",
          amountCents: null,
          failureMessage: null,
        };
    }
  }
}
