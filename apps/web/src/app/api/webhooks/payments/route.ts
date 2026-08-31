import { NextResponse } from "next/server";

import { getOrderStore } from "@/lib/orders/store";
import { getPaymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";
// Node runtime, not Edge: signature verification needs `node:crypto`, and
// Stripe's SDK is not Edge-compatible.
export const runtime = "nodejs";

/**
 * Payment gateway callback.
 *
 * This is the only place an order becomes PLACED. The client's "payment
 * succeeded" callback is a UI hint and nothing more — a guest who closes the
 * tab the instant their card clears must still get their food, and a client
 * that claims success must not be believed.
 *
 * Three rules this endpoint follows, all of them learned the hard way:
 *
 *  1. **Read the raw body.** Signature verification is computed over the exact
 *     bytes sent. `request.json()` re-serialises and the signature will never
 *     match — a failure that looks like a wrong secret and wastes an afternoon.
 *  2. **A bad signature is 400, never 500.** Gateways retry 5xx with backoff
 *     for days; returning 500 for a forged request means being hammered by it.
 *  3. **Deduplicate on the event id.** Gateways deliver at least once, so the
 *     same success event will arrive twice. Awarding loyalty points or sending
 *     a confirmation SMS twice is the visible symptom.
 */

// Bounded so a flood of events cannot grow it without limit. In production
// this is a Redis SETNX with a 24-hour TTL, shared across instances — a
// per-process Set only deduplicates for the instance that saw the first copy.
const MAX_SEEN = 1000;
const seenEvents = new Set<string>();

const remember = (eventId: string): boolean => {
  if (seenEvents.has(eventId)) return false;
  if (seenEvents.size >= MAX_SEEN) {
    const oldest = seenEvents.values().next().value;
    if (oldest) seenEvents.delete(oldest);
  }
  seenEvents.add(eventId);
  return true;
};

export async function POST(request: Request) {
  const provider = getPaymentProvider();

  const signature =
    request.headers.get("stripe-signature") ??
    request.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature header" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event;
  try {
    event = await provider.verifyWebhook(rawBody, signature);
  } catch (error) {
    console.warn("[webhook] signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!remember(event.eventId)) {
    // Already processed. Acknowledge so the gateway stops retrying.
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.status === "IGNORED" || !event.orderId) {
    return NextResponse.json({ received: true });
  }

  const store = getOrderStore();

  try {
    switch (event.status) {
      case "SUCCEEDED":
        // The kitchen learns about the order here and nowhere else.
        await store.markStatus(event.orderId, "PLACED");
        console.info(
          `[webhook] order ${event.orderId} paid via ${provider.name} (${event.paymentId})`,
        );
        break;

      case "FAILED":
        await store.markStatus(event.orderId, "PAYMENT_FAILED");
        console.warn(
          `[webhook] payment failed for order ${event.orderId}: ${event.failureMessage}`,
        );
        break;

      case "PENDING":
        // PayNow and bank transfers sit here until the guest completes the
        // transfer in their banking app. Nothing to do but wait.
        break;
    }
  } catch (error) {
    // Processing failed after a valid signature — this one *should* be
    // retried, so let the gateway retry it.
    console.error("[webhook] processing failed:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
