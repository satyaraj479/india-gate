import { NextResponse } from "next/server";
import { z } from "zod";

import { repriceOrder } from "@/lib/checkout/reprice";
import { getOrderStore } from "@/lib/orders/store";
import { setReceiptCookie } from "@/lib/orders/receipt";
import { getPaymentProvider, PaymentConfigurationError } from "@/lib/payments";
import { getSiteUrl } from "@/lib/site-url";
import {
  customerContactSchema,
  deliveryAddressSchema,
} from "@/types/customer";
import type { CreateOrderRequest, CreateOrderResponse, ProblemDocument } from "@/types/order";

// Payments must never be prerendered or cached.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  fulfilmentMode: z.enum(["DELIVERY", "TAKEAWAY"]),
  items: z
    .array(
      z.object({
        dishId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        optionIds: z.array(z.string().min(1)).max(30),
        specialInstructions: z.string().max(300).nullable(),
      }),
    )
    .min(1)
    .max(60),
  contact: customerContactSchema,
  deliveryAddress: deliveryAddressSchema.nullable(),
  couponCode: z.string().max(24).nullable(),
  orderNotes: z.string().max(500).default(""),
  scheduledFor: z.string().datetime().nullable(),
  paymentMethodType: z.enum([
    "CARD",
    "PAYNOW",
    "GRABPAY",
    "APPLE_PAY",
    "GOOGLE_PAY",
    "CASH_ON_DELIVERY",
  ]),
  expectedTotalCents: z.number().int().min(0),
});

const problem = (doc: ProblemDocument) =>
  NextResponse.json(doc, {
    status: doc.status,
    headers: { "Content-Type": "application/problem+json" },
  });

/**
 * Create an order and open a payment.
 *
 * Order of operations is deliberate:
 *
 *   validate shape → reprice from the catalog → persist the order unpaid →
 *   open the payment intent
 *
 * The order is written *before* the gateway is called so that a payment can
 * never exist without an order to attach it to. The reverse ordering produces
 * the worst possible failure: money taken, nothing to deliver, and no record
 * to refund against.
 *
 * The order is created in PENDING_PAYMENT and is not sent to the kitchen here.
 * Only the webhook promotes it, so an abandoned 3-D Secure challenge does not
 * put a ticket on the pass.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return problem({
      type: "checkout/malformed-body",
      title: "Malformed request",
      status: 400,
      detail: "The request body was not valid JSON.",
    });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return problem({
      type: "checkout/validation-failed",
      title: "Some details need fixing",
      status: 422,
      detail: "Please check the highlighted fields and try again.",
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  const body = parsed.data as CreateOrderRequest;

  // Every price in the response below comes from here, never from the client.
  const repriced = await repriceOrder(body);
  if (!repriced.ok) {
    return problem({
      type: repriced.type,
      title: repriced.title,
      status: repriced.status,
      detail: repriced.detail,
      ...(repriced.repricedTotals ? { repricedTotals: repriced.repricedTotals } : {}),
    });
  }

  const store = getOrderStore();
  const order = await store.create({
    fulfilmentMode: body.fulfilmentMode,
    items: repriced.items,
    totals: repriced.totals,
    contact: body.contact,
    deliveryAddress: body.deliveryAddress,
    couponCode: body.couponCode,
    orderNotes: body.orderNotes,
    scheduledFor: body.scheduledFor,
    paymentMethodType: body.paymentMethodType,
  });

  // Cash on delivery skips the gateway entirely but still produces an order in
  // the same shape, so the client has one success path rather than two.
  if (body.paymentMethodType === "CASH_ON_DELIVERY") {
    await store.markStatus(order.id, "PLACED");
    setReceiptCookie({ ...order, status: "PLACED" });
    const response: CreateOrderResponse = {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: "PLACED",
        totals: order.totals,
      },
      payment: {
        provider: "stripe",
        paymentId: `cod_${order.id}`,
        action: "NONE",
        clientSecret: null,
        redirectUrl: null,
        qrCodeData: null,
        amountCents: order.totals.totalCents,
        currency: order.totals.currency,
        providerOrderId: null,
        publishableKey: null,
      },
    };
    return NextResponse.json(response, { status: 201 });
  }

  try {
    const payment = await getPaymentProvider().createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents: order.totals.totalCents,
      currency: order.totals.currency,
      methodType: body.paymentMethodType,
      customer: {
        name: `${body.contact.firstName} ${body.contact.lastName}`.trim(),
        email: body.contact.email,
        phone: body.contact.phone,
      },
      // Same empty-string trap as metadataBase — see lib/site-url.ts. Here it
      // would be worse than a failed build: the gateway would be handed a
      // malformed return URL and the guest would be stranded after paying.
      returnUrl: new URL(
        `/checkout/confirmation/${order.orderNumber}`,
        getSiteUrl(),
      ).toString(),
      // The order id is stable for this order and only ever used once, which
      // is exactly what a gateway idempotency key needs to be.
      idempotencyKey: order.id,
    });

    await store.attachPaymentIntent(order.id, payment.paymentId);

    // The confirmation page reads this when the in-memory store misses, which
    // on a serverless deploy is most of the time — the GET lands on a
    // different instance from this POST. See lib/orders/receipt.ts.
    setReceiptCookie(order);

    const response: CreateOrderResponse = {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totals: order.totals,
      },
      payment,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentConfigurationError) {
      // A missing key is our fault, not the guest's. Say so plainly rather
      // than showing "payment declined", which sends them to their bank.
      console.error("[checkout] payment provider misconfigured:", error.message);
      return problem({
        type: "checkout/payment-unavailable",
        title: "Card payment is temporarily unavailable",
        status: 503,
        detail:
          "We could not reach the payment provider. Please try cash on delivery, or call the restaurant.",
      });
    }

    console.error("[checkout] payment creation failed:", error);
    await store.markStatus(order.id, "PAYMENT_FAILED");
    return problem({
      type: "checkout/payment-failed",
      title: "We could not start the payment",
      status: 502,
      detail: "Nothing has been charged. Please try again in a moment.",
    });
  }
}
