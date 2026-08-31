"use client";

import { Info, Sparkles } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { useCartTotals } from "@/hooks/use-cart-totals";
import { useCartStore } from "@/store/cart-store";
import { useFulfilmentStore } from "@/store/fulfilment-store";
import { formatMoney } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * The order summary.
 *
 * Every figure comes from `useCartTotals`, which delegates to the shared
 * pricing engine. Nothing here adds two numbers together — if a line is
 * missing from the total, the bug is in one place rather than in whichever
 * component last touched it.
 *
 * GST is shown as *included* rather than added, because menu prices in
 * Singapore are quoted inclusive. Displaying it as an addition on top would
 * overstate the total by 9% and is the most common mistake in a Singaporean
 * checkout.
 */
export function OrderSummary({ className }: { className?: string }) {
  const totals = useCartTotals();
  const coupon = useCartStore((s) => s.coupon);
  const mode = useFulfilmentStore((s) => s.mode);
  const deliveryLocation = useFulfilmentStore((s) => s.deliveryLocation);

  const isDelivery = mode === "DELIVERY";
  const freeDelivery = isDelivery && totals.deliveryFeeCents === 0;

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      <Row label="Subtotal" value={formatMoney(totals.subtotalCents)} />

      {totals.discountCents > 0 && (
        <Row
          label={coupon ? `Discount (${coupon.code})` : "Discount"}
          value={`−${formatMoney(totals.discountCents)}`}
          tone="positive"
        />
      )}

      {isDelivery && (
        <Row
          label="Delivery"
          value={
            freeDelivery ? (
              <span className="font-medium text-veg">Free</span>
            ) : (
              formatMoney(totals.deliveryFeeCents)
            )
          }
          hint={deliveryLocation ? deliveryLocation.areaName : undefined}
        />
      )}

      <Row
        label={isDelivery ? "Packaging" : "Takeaway packaging"}
        value={formatMoney(totals.packagingFeeCents)}
      />

      <Row
        label="GST (9%)"
        value={formatMoney(totals.gstCents)}
        hint="Included in the prices shown"
      />

      <Separator className="my-3" />

      <div className="flex items-baseline justify-between">
        <span className="text-base font-semibold">Total</span>
        <span className="heading-serif text-2xl font-semibold tabular-nums text-gold">
          {formatMoney(totals.totalCents)}
        </span>
      </div>

      {totals.amountToFreeDeliveryCents !== null &&
        totals.amountToFreeDeliveryCents > 0 &&
        isDelivery && (
          <p className="flex items-start gap-1.5 rounded-md border border-gold/20 bg-gold/[0.06] px-2.5 py-2 text-xs text-gold-400">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Add {formatMoney(totals.amountToFreeDeliveryCents)} more for free delivery.
          </p>
        )}

      {totals.pointsToEarn > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold/70" />
          Earns{" "}
          <span className="font-medium text-foreground">
            {totals.pointsToEarn.toLocaleString("en-SG")} Gate Points
          </span>
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "positive";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">
        {label}
        {hint && <span className="ml-1.5 text-xs text-muted-foreground/70">{hint}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          tone === "positive" ? "font-medium text-veg" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
