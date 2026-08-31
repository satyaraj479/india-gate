"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, ShoppingCart, Utensils } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CartLineRow } from "./cart-line-row";
import { OrderSummary } from "./order-summary";
import { PromoCodeField } from "./promo-code-field";
import { selectItemCount, useCartStore } from "@/store/cart-store";
import { useCartTotals } from "@/hooks/use-cart-totals";
import { useFulfilmentStore } from "@/store/fulfilment-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatMoney } from "@/lib/pricing";

/**
 * Slide-over cart.
 *
 * The one structural decision worth naming: the header and the footer are
 * fixed and only the item list scrolls. On a phone with eight lines in the
 * cart, a footer that scrolls away takes the total and the checkout button
 * with it, and guests genuinely cannot find them.
 *
 * Checkout is blocked — with the reason stated inline, not as a disabled
 * button with no explanation — when the order is under the zone minimum or
 * delivery is selected without an address.
 */
export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen);
  const setOpen = useCartStore((s) => s.setOpen);
  const items = useCartStore((s) => s.items);
  const itemCount = useCartStore(selectItemCount);
  const clear = useCartStore((s) => s.clear);

  const mode = useFulfilmentStore((s) => s.mode);
  const deliveryLocation = useFulfilmentStore((s) => s.deliveryLocation);
  const openValidator = useFulfilmentStore((s) => s.openValidator);

  const totals = useCartTotals();
  const hydrated = useHydrated();

  const isEmpty = items.length === 0;
  const isDelivery = mode === "DELIVERY";

  const needsAddress = isDelivery && !deliveryLocation;
  const minOrderCents = deliveryLocation?.minOrderCents ?? 0;
  const belowMinimum =
    isDelivery && !needsAddress && totals.subtotalCents < minOrderCents;

  const blocker = needsAddress
    ? {
        message: "Add a delivery address to continue.",
        action: { label: "Add address", onClick: openValidator },
      }
    : belowMinimum
      ? {
          message: `Delivery orders start at ${formatMoney(minOrderCents)}. Add ${formatMoney(
            minOrderCents - totals.subtotalCents,
          )} more, or switch to self-pickup.`,
          action: null,
        }
      : null;

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between space-y-0 pr-12">
          <div>
            <SheetTitle>Your order</SheetTitle>
            <SheetDescription>
              {hydrated && !isEmpty
                ? `${itemCount} ${itemCount === 1 ? "item" : "items"} · ${
                    isDelivery ? "Delivery" : "Self-pickup"
                  }`
                : "Nothing added yet"}
            </SheetDescription>
          </div>
          {!isEmpty && (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-destructive hover:underline"
            >
              Clear all
            </button>
          )}
        </SheetHeader>

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-navy-800">
              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="heading-serif text-lg font-medium">Your cart is empty</p>
              <p className="text-sm text-muted-foreground">
                The dosai are ground fresh this morning and the biryani goes on
                dum at four.
              </p>
            </div>
            <Button asChild onClick={() => setOpen(false)}>
              <Link href="/menu">
                <Utensils className="h-4 w-4" />
                Browse the menu
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Only this region scrolls. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              <ul className="divide-y divide-white/[0.07]">
                {items.map((item) => (
                  <CartLineRow key={item.lineId} item={item} />
                ))}
              </ul>

              <div className="py-4">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="w-full border border-dashed border-white/12"
                >
                  <Link href="/menu">+ Add more items</Link>
                </Button>
              </div>
            </div>

            <SheetFooter className="flex-col gap-4">
              <PromoCodeField />
              <Separator />
              <OrderSummary />

              {blocker && (
                <div className="flex items-start gap-2 rounded-md border border-gold/25 bg-gold/[0.07] px-3 py-2.5">
                  <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-gold" />
                  <div className="space-y-1.5 text-xs text-foreground/90">
                    <p>{blocker.message}</p>
                    {blocker.action && (
                      <button
                        type="button"
                        onClick={blocker.action.onClick}
                        className="font-medium text-gold underline underline-offset-4"
                      >
                        {blocker.action.label}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <Button
                asChild={!blocker}
                size="lg"
                disabled={Boolean(blocker)}
                className="w-full justify-between"
                onClick={() => !blocker && setOpen(false)}
              >
                {blocker ? (
                  <span className="flex w-full items-center justify-between">
                    <span>Checkout</span>
                    <span className="tabular-nums">{formatMoney(totals.totalCents)}</span>
                  </span>
                ) : (
                  <Link href="/checkout">
                    <span className="flex items-center gap-2">
                      Checkout
                      <ArrowRight className="h-4 w-4" />
                    </span>
                    <span className="tabular-nums">{formatMoney(totals.totalCents)}</span>
                  </Link>
                )}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
