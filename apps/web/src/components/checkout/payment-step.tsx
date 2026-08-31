"use client";

import { useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { AlertCircle, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/pricing";
import type { PaymentIntentEnvelope } from "@/types/order";

/**
 * Card / wallet payment.
 *
 * Stripe's Payment Element renders inside a cross-origin iframe, so card
 * details never touch our origin, our JavaScript or our server — which is what
 * keeps this app out of PCI DSS scope beyond the shortest self-assessment.
 * Never reimplement this with your own inputs.
 *
 * `loadStripe` is memoised outside the component tree: calling it on every
 * render re-downloads Stripe.js and remounts the iframe, wiping whatever the
 * guest has typed.
 */
const stripeCache = new Map<string, Promise<Stripe | null>>();

const getStripePromise = (publishableKey: string) => {
  let promise = stripeCache.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripeCache.set(publishableKey, promise);
  }
  return promise;
};

export function PaymentStep({
  payment,
  orderNumber,
  onBack,
}: {
  payment: PaymentIntentEnvelope;
  orderNumber: string;
  onBack: () => void;
}) {
  const stripePromise = useMemo(
    () => (payment.publishableKey ? getStripePromise(payment.publishableKey) : null),
    [payment.publishableKey],
  );

  if (!payment.clientSecret || !stripePromise) {
    return (
      <div className="surface flex gap-3 p-5">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">Card payment is not configured</p>
          <p className="text-muted-foreground">
            Set <code className="text-gold">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
            and <code className="text-gold">STRIPE_SECRET_KEY</code> in{" "}
            <code className="text-gold">.env.local</code>, or choose cash on
            delivery.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="pt-1 font-medium text-gold underline underline-offset-4"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: payment.clientSecret,
        // Matching the brand inside the iframe is not vanity: a payment form
        // that looks foreign to the page is the most common reason guests
        // abandon at the last step.
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#D4AF37",
            colorBackground: "#121A38",
            colorText: "#FFFFFF",
            colorDanger: "#E2504A",
            fontFamily: "var(--font-sans), system-ui, sans-serif",
            borderRadius: "8px",
            spacingUnit: "4px",
          },
        },
      }}
    >
      <PaymentForm
        amountCents={payment.amountCents}
        orderNumber={orderNumber}
        onBack={onBack}
      />
    </Elements>
  );
}

function PaymentForm({
  amountCents,
  orderNumber,
  onBack,
}: {
  amountCents: number;
  orderNumber: string;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/confirmation/${orderNumber}`,
      },
      // Only redirect when the method genuinely requires it (3-D Secure,
      // PayNow). A plain card stays on the page and we show the result here.
      redirect: "if_required",
    });

    if (stripeError) {
      // card_error and validation_error carry messages written for guests;
      // everything else is ours to phrase, because Stripe's internal wording
      // ("an unexpected error occurred") tells them nothing useful.
      setError(
        stripeError.type === "card_error" || stripeError.type === "validation_error"
          ? (stripeError.message ?? "Your card was declined.")
          : "Something went wrong taking the payment. Nothing has been charged.",
      );
      setSubmitting(false);
      return;
    }

    // No error and no redirect means the payment succeeded inline. The order
    // is confirmed by the webhook, not by this line — we are only navigating.
    window.location.assign(`/checkout/confirmation/${orderNumber}`);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={!stripe || submitting}
        className="w-full justify-between"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Pay now
          </span>
        )}
        <span className="tabular-nums">{formatMoney(amountCents)}</span>
      </Button>

      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="w-full text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
      >
        Back to details
      </button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        Card details go straight to Stripe. They never reach our servers.
      </p>
    </form>
  );
}
