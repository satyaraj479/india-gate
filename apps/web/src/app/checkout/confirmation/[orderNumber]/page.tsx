import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bike, CheckCircle2, Clock, MapPin, Receipt, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DietaryMark } from "@/components/menu/dietary-mark";
import { ClearCartOnMount } from "@/components/checkout/clear-cart-on-mount";
import { getOrderStore } from "@/lib/orders/store";
import { readReceiptCookie, toReceipt, type Receipt as ReceiptData } from "@/lib/orders/receipt";
import { formatMoney } from "@/lib/pricing";
import { OUTLET } from "@/lib/config";
import { ORDER_STATUS_LABEL } from "@/types/order";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

// Reads cookies and looks the order up per request; nothing here may be cached.
export const dynamic = "force-dynamic";

/** Order numbers are IG-DDMM-NNNN. Anything else is a typo or a probe. */
const ORDER_NUMBER_PATTERN = /^IG-\d{4}-\d{4}$/;

export default async function ConfirmationPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  const orderNumber = params.orderNumber.toUpperCase();
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();

  // Store first — authoritative and complete when this instance handled the
  // checkout. Cookie second, which is the usual path on serverless.
  const order = await getOrderStore().findByNumber(orderNumber);
  const receipt: ReceiptData | null = order
    ? toReceipt(order)
    : readReceiptCookie(orderNumber);

  // Neither: a valid-looking number we cannot resolve. Almost always a
  // bookmarked confirmation opened days later. Acknowledge the order rather
  // than 404ing someone who really did pay — a "page not found" after a
  // payment is the most alarming thing this app could show.
  if (!receipt) {
    return (
      <div className="container max-w-lg py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-navy-800">
          <Receipt className="h-6 w-6 text-gold/70" />
        </div>
        <h1 className="heading-serif mt-5 text-2xl font-semibold">
          We no longer have this receipt to hand
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Order <span className="font-mono text-gold">{orderNumber}</span> is
          not lost — receipts are only kept in this browser for a couple of
          hours. Your confirmation email has the full breakdown, and the
          restaurant can look the order up by that number.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <a href={`tel:${OUTLET.phone.replace(/\s/g, "")}`}>
              Call {OUTLET.phoneDisplay}
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/menu">Back to the menu</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isPickup = receipt.fulfilmentMode === "TAKEAWAY";
  const eta = isPickup ? receipt.promisedReadyAt : receipt.estimatedArrivalAt;

  return (
    <div className="container max-w-2xl py-12">
      {/* Emptying the cart is deferred to the client and to *this* page: doing
          it at submit time loses the guest's order if the payment then fails. */}
      <ClearCartOnMount />

      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-veg/30 bg-veg/10">
          <CheckCircle2 className="h-8 w-8 text-veg" />
        </div>
        <h1 className="heading-serif mt-5 text-3xl font-semibold sm:text-4xl">
          Thank you, {receipt.firstName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {receipt.status === "PENDING_PAYMENT"
            ? "We are confirming your payment. The kitchen starts as soon as it clears."
            : "Your order is with the kitchen."}
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.08] px-4 py-2">
          <Receipt className="h-4 w-4 text-gold" />
          <span className="font-mono text-sm font-semibold tracking-wider text-gold">
            {receipt.orderNumber}
          </span>
        </p>
      </div>

      <div className="surface mt-8 divide-y divide-white/[0.07]">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Detail
            icon={isPickup ? ShoppingBag : Bike}
            label={isPickup ? "Self-pickup from" : "Delivering to"}
            value={
              isPickup ? (
                <>
                  {OUTLET.addressLine1}, {OUTLET.addressLine2}
                  <br />
                  Singapore {OUTLET.postalCode}
                </>
              ) : (
                <>
                  {receipt.addressLine1}
                  {receipt.unitNumber ? `, ${receipt.unitNumber}` : ""}
                  <br />
                  Singapore {receipt.postalCode}
                </>
              )
            }
          />
          <Detail
            icon={Clock}
            label={isPickup ? "Ready by" : "Arriving by"}
            value={
              eta
                ? new Intl.DateTimeFormat("en-SG", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "Asia/Singapore",
                  }).format(new Date(eta))
                : "We will text you shortly"
            }
          />
          {receipt.pickupCode && (
            <Detail
              icon={MapPin}
              label="Collection code"
              value={
                <span className="font-mono text-lg font-semibold tracking-widest text-gold">
                  {receipt.pickupCode}
                </span>
              }
            />
          )}
          <Detail
            icon={Receipt}
            label="Status"
            value={ORDER_STATUS_LABEL[receipt.status]}
          />
        </div>

        <div className="p-5">
          <h2 className="heading-serif mb-3 text-base font-semibold">
            What you ordered
          </h2>

          {receipt.lines.length > 0 ? (
            <ul className="space-y-3">
              {receipt.lines.map((line, i) => (
                <li key={`${line.name}-${i}`} className="flex justify-between gap-4 text-sm">
                  <span className="flex min-w-0 items-start gap-2">
                    <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                      {line.quantity}×
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <DietaryMark type={line.dietaryType} size={11} />
                        {line.name}
                      </span>
                      {line.options.length > 0 && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {line.options.join(" · ")}
                        </span>
                      )}
                      {line.note && (
                        <span className="mt-0.5 block text-xs italic text-gold-400/80">
                          “{line.note}”
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney(line.lineTotalCents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              The full itemised list is in your confirmation email.
            </p>
          )}

          <Separator className="my-4" />

          <dl className="space-y-1.5 text-sm">
            <Line label="Subtotal" value={formatMoney(receipt.totals.subtotalCents)} />
            {receipt.totals.discountCents > 0 && (
              <Line
                label={receipt.couponCode ? `Discount (${receipt.couponCode})` : "Discount"}
                value={`−${formatMoney(receipt.totals.discountCents)}`}
              />
            )}
            {!isPickup && (
              <Line label="Delivery" value={formatMoney(receipt.totals.deliveryFeeCents)} />
            )}
            <Line label="Packaging" value={formatMoney(receipt.totals.packagingFeeCents)} />
            <Line label="GST (9%, included)" value={formatMoney(receipt.totals.gstCents)} />
          </dl>

          <Separator className="my-4" />

          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Paid</span>
            <span className="heading-serif text-2xl font-semibold tabular-nums text-gold">
              {formatMoney(receipt.totals.totalCents)}
            </span>
          </div>

          {receipt.totals.pointsToEarn > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              You earned{" "}
              <span className="font-medium text-gold">
                {receipt.totals.pointsToEarn.toLocaleString("en-SG")} Gate Points
              </span>{" "}
              on this order.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild variant="outline">
          <Link href="/menu">Order something else</Link>
        </Button>
        <Button asChild variant="ghost">
          <a href={`tel:${OUTLET.phone.replace(/\s/g, "")}`}>Call the restaurant</a>
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        A receipt is on its way to {receipt.email}.
      </p>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
      <div className="min-w-0 text-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
