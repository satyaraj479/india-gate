"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Bike,
  CreditCard,
  Loader2,
  MapPin,
  QrCode,
  ShoppingBag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { OrderSummary } from "@/components/cart/order-summary";
import { CartLineRow } from "@/components/cart/cart-line-row";
import { PaymentStep } from "./payment-step";
import { useCartStore } from "@/store/cart-store";
import { useFulfilmentStore } from "@/store/fulfilment-store";
import { useCartTotals } from "@/hooks/use-cart-totals";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatMoney } from "@/lib/pricing";
import { OUTLET } from "@/lib/config";
import { cn } from "@/lib/utils";
import { checkoutFormSchema, type CheckoutFormValues } from "@/types/customer";
import type {
  CreateOrderResponse,
  PaymentIntentEnvelope,
  PaymentMethodType,
  ProblemDocument,
} from "@/types/order";

type Stage =
  | { name: "DETAILS" }
  | { name: "PAYMENT"; payment: PaymentIntentEnvelope; orderNumber: string };

const PAYMENT_METHODS: Array<{
  value: PaymentMethodType;
  label: string;
  hint: string;
  icon: typeof CreditCard;
}> = [
  { value: "CARD", label: "Card", hint: "Visa, Mastercard, Amex", icon: CreditCard },
  { value: "PAYNOW", label: "PayNow", hint: "Scan with your banking app", icon: QrCode },
  {
    value: "CASH_ON_DELIVERY",
    label: "Cash",
    hint: "Pay the rider or at the counter",
    icon: Banknote,
  },
];

/**
 * Checkout.
 *
 * Two stages, one page. Details are collected first and the payment intent is
 * only created once they are valid — creating it upfront leaves an abandoned
 * intent on the gateway for every guest who opens the page and leaves, which
 * makes the payment dashboard useless for spotting real failures.
 *
 * The server reprices everything on submit. When it disagrees with what the
 * guest was shown, the response carries the corrected totals and we surface
 * the difference rather than quietly charging the new amount.
 */
export function CheckoutClient() {
  const router = useRouter();
  const hydrated = useHydrated();

  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const clearCart = useCartStore((s) => s.clear);
  const mode = useFulfilmentStore((s) => s.mode);
  const deliveryLocation = useFulfilmentStore((s) => s.deliveryLocation);
  const openValidator = useFulfilmentStore((s) => s.openValidator);
  const totals = useCartTotals();

  const [stage, setStage] = useState<Stage>({ name: "DETAILS" });
  const [method, setMethod] = useState<PaymentMethodType>("CARD");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<ProblemDocument | null>(null);

  const isDelivery = mode === "DELIVERY";

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      contact: { firstName: "", lastName: "", phone: "", email: "" },
      address: {
        addressLine1: "",
        unitNumber: "",
        buildingName: "",
        postalCode: "",
        deliveryNotes: "",
        leaveAtDoor: false,
      },
      scheduledFor: null,
      orderNotes: "",
      marketingOptIn: false,
    },
  });

  // Prefill from whatever the guest already gave the address modal.
  useEffect(() => {
    if (!deliveryLocation) return;
    form.setValue("address.postalCode", deliveryLocation.postalCode);
    form.setValue("address.addressLine1", deliveryLocation.addressLine1);
    form.setValue("address.unitNumber", deliveryLocation.unitNumber ?? "");
    form.setValue("address.deliveryNotes", deliveryLocation.deliveryNotes ?? "");
  }, [deliveryLocation, form]);

  // An empty cart on this page is always a mistake — a refresh after ordering,
  // or a stale tab. Send them back rather than showing an empty summary.
  useEffect(() => {
    if (hydrated && items.length === 0 && stage.name === "DETAILS") {
      router.replace("/menu");
    }
  }, [hydrated, items.length, stage.name, router]);

  const submit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setProblem(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfilmentMode: mode,
          items: items.map((item) => ({
            dishId: item.dishId,
            quantity: item.quantity,
            optionIds: item.selections.map((s) => s.optionId),
            specialInstructions: item.specialInstructions,
          })),
          contact: values.contact,
          deliveryAddress: isDelivery ? values.address : null,
          couponCode: coupon?.code ?? null,
          orderNotes: values.orderNotes,
          scheduledFor: values.scheduledFor,
          paymentMethodType: method,
          // Cross-check only. The server decides the real number.
          expectedTotalCents: totals.totalCents,
        }),
      });

      if (!response.ok) {
        setProblem((await response.json()) as ProblemDocument);
        setSubmitting(false);
        return;
      }

      const result = (await response.json()) as CreateOrderResponse;

      if (result.payment.action === "NONE") {
        clearCart();
        router.push(`/checkout/confirmation/${result.order.orderNumber}`);
        return;
      }

      setStage({
        name: "PAYMENT",
        payment: result.payment,
        orderNumber: result.order.orderNumber,
      });
    } catch {
      setProblem({
        type: "network/unreachable",
        title: "We could not reach the kitchen",
        status: 0,
        detail: "Check your connection and try again. Nothing has been charged.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  if (!hydrated) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="container py-10">
      <Link
        href="/menu"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the menu
      </Link>

      <h1 className="heading-serif text-3xl font-semibold sm:text-4xl">Checkout</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {isDelivery
          ? `Delivering to ${deliveryLocation?.areaName ?? "your address"} · about ${deliveryLocation?.etaMinutes ?? 45} minutes`
          : `Self-pickup from ${OUTLET.addressLine1}, ${OUTLET.addressLine2}`}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {problem && (
            <div
              role="alert"
              className="surface flex gap-3 border-destructive/40 bg-destructive/[0.08] p-4"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="space-y-1.5 text-sm">
                <p className="font-medium">{problem.title}</p>
                {problem.detail && (
                  <p className="text-muted-foreground">{problem.detail}</p>
                )}
                {problem.repricedTotals && (
                  <p className="text-muted-foreground">
                    Updated total:{" "}
                    <span className="font-semibold text-gold">
                      {formatMoney(problem.repricedTotals.totalCents)}
                    </span>
                  </p>
                )}
                {problem.errors && problem.errors.length > 0 && (
                  <ul className="list-inside list-disc text-xs text-muted-foreground">
                    {problem.errors.map((e) => (
                      <li key={`${e.field}-${e.code}`}>{e.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {stage.name === "PAYMENT" ? (
            <section className="surface p-5">
              <h2 className="heading-serif mb-4 text-lg font-semibold">Payment</h2>
              <PaymentStep
                payment={stage.payment}
                orderNumber={stage.orderNumber}
                onBack={() => setStage({ name: "DETAILS" })}
              />
            </section>
          ) : (
            <form onSubmit={submit} className="space-y-6" noValidate>
              {/* Contact */}
              <section className="surface p-5">
                <h2 className="heading-serif mb-4 text-lg font-semibold">
                  Your details
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="First name"
                    error={form.formState.errors.contact?.firstName?.message}
                  >
                    <Input
                      autoComplete="given-name"
                      {...form.register("contact.firstName")}
                    />
                  </Field>
                  <Field
                    label="Last name"
                    optional
                    error={form.formState.errors.contact?.lastName?.message}
                  >
                    <Input
                      autoComplete="family-name"
                      {...form.register("contact.lastName")}
                    />
                  </Field>
                  <Field
                    label="Mobile"
                    hint="The rider will call this number"
                    error={form.formState.errors.contact?.phone?.message}
                  >
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="9123 4567"
                      {...form.register("contact.phone")}
                    />
                  </Field>
                  <Field
                    label="Email"
                    hint="For your receipt"
                    error={form.formState.errors.contact?.email?.message}
                  >
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      {...form.register("contact.email")}
                    />
                  </Field>
                </div>
              </section>

              {/* Address or pickup */}
              <section className="surface p-5">
                <h2 className="heading-serif mb-4 flex items-center gap-2 text-lg font-semibold">
                  {isDelivery ? (
                    <>
                      <Bike className="h-5 w-5 text-gold" />
                      Delivery address
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-5 w-5 text-gold" />
                      Pickup
                    </>
                  )}
                </h2>

                {isDelivery ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field
                        label="Street address"
                        error={form.formState.errors.address?.addressLine1?.message}
                      >
                        <Input
                          autoComplete="address-line1"
                          {...form.register("address.addressLine1")}
                        />
                      </Field>
                    </div>
                    <Field
                      label="Unit / floor"
                      optional
                      error={form.formState.errors.address?.unitNumber?.message}
                    >
                      <Input
                        autoComplete="address-line2"
                        placeholder="#12-04"
                        {...form.register("address.unitNumber")}
                      />
                    </Field>
                    <Field
                      label="Postcode"
                      error={form.formState.errors.address?.postalCode?.message}
                    >
                      <Input
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={6}
                        className="font-mono tracking-[0.2em]"
                        {...form.register("address.postalCode")}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Notes for the rider" optional>
                        <Textarea
                          placeholder="Lift lobby B, call on arrival"
                          maxLength={300}
                          {...form.register("address.deliveryNotes")}
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      onClick={openValidator}
                      className="justify-self-start text-xs font-medium text-gold underline underline-offset-4"
                    >
                      Change delivery zone
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3 rounded-md border border-white/10 bg-navy-900/50 p-4">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <div className="text-sm">
                      <p className="font-medium">{OUTLET.name}</p>
                      <p className="text-muted-foreground">
                        {OUTLET.addressLine1}, {OUTLET.addressLine2}
                        <br />
                        Singapore {OUTLET.postalCode}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        We will text you a collection code when it is ready.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Payment method */}
              <section className="surface p-5">
                <h2 className="heading-serif mb-4 text-lg font-semibold">
                  How would you like to pay?
                </h2>
                <div
                  role="radiogroup"
                  aria-label="Payment method"
                  className="grid gap-2 sm:grid-cols-3"
                >
                  {PAYMENT_METHODS.map((option) => {
                    const selected = method === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setMethod(option.value)}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                          selected
                            ? "border-gold/60 bg-gold/[0.08] shadow-gold"
                            : "border-white/10 bg-navy-900/40 hover:border-white/20",
                        )}
                      >
                        <option.icon
                          className={cn(
                            "h-4 w-4",
                            selected ? "text-gold" : "text-muted-foreground",
                          )}
                        />
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Separator className="my-5" />

                <Field label="Anything else for the kitchen?" optional>
                  <Textarea
                    placeholder="Ring the bell twice — the baby is asleep"
                    maxLength={500}
                    {...form.register("orderNotes")}
                  />
                </Field>

                <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 accent-[hsl(var(--gold-500))]"
                    {...form.register("marketingOptIn")}
                  />
                  Send me the occasional note about festival menus and new
                  dishes. No more than once a month.
                </label>
              </section>

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full justify-between"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming your order…
                  </span>
                ) : (
                  <span>
                    {method === "CASH_ON_DELIVERY" ? "Place order" : "Continue to payment"}
                  </span>
                )}
                <span className="tabular-nums">{formatMoney(totals.totalCents)}</span>
              </Button>
            </form>
          )}
        </div>

        {/* Order summary */}
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="surface p-5">
            <h2 className="heading-serif mb-1 text-lg font-semibold">Your order</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "line" : "lines"}
            </p>

            <ul className="max-h-[280px] divide-y divide-white/[0.07] overflow-y-auto">
              {items.map((item) => (
                <CartLineRow key={item.lineId} item={item} />
              ))}
            </ul>

            <Separator className="my-4" />
            <OrderSummary />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  optional,
  error,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  // The control is nested inside the label rather than linked by id. Implicit
  // association is valid HTML, gives the same click-to-focus behaviour, and
  // avoids threading a generated id through every `register()` call — where a
  // single mismatch silently leaves a field unlabelled for screen readers.
  return (
    <div className="space-y-1.5">
      <Label className="block">
        <span className="mb-1.5 block">
          {label}
          {optional && (
            <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          )}
        </span>
        {children}
      </Label>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
