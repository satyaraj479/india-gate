"use client";

import { ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCartStore, selectItemCount } from "@/store/cart-store";
import { useCartTotals } from "@/hooks/use-cart-totals";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatMoney } from "@/lib/pricing";

/**
 * Header cart button: live item count and running total.
 *
 * The total sits in the button on desktop because it is the number guests
 * check most often, and making them open the drawer to see it is a small tax
 * paid on every single visit.
 *
 * Renders the empty state until hydration — see `useHydrated` for why.
 */
export function CartTrigger({ className }: { className?: string }) {
  const itemCount = useCartStore(selectItemCount);
  const openCart = useCartStore((s) => s.openCart);
  const totals = useCartTotals();
  const hydrated = useHydrated();

  const count = hydrated ? itemCount : 0;
  const hasItems = count > 0;

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={
        hasItems
          ? `Open cart, ${count} ${count === 1 ? "item" : "items"}, ${formatMoney(totals.totalCents)}`
          : "Open cart, empty"
      }
      className={cn(
        "group relative flex items-center gap-2 rounded-full border px-3 py-2 transition-all",
        hasItems
          ? "border-gold/45 bg-gold/10 hover:border-gold/70 hover:bg-gold/15"
          : "border-white/10 bg-navy-800/80 hover:border-white/20",
        className,
      )}
    >
      <span className="relative">
        <ShoppingCart
          className={cn(
            "h-[18px] w-[18px] transition-colors",
            hasItems ? "text-gold" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        {hasItems && (
          <span
            className="absolute -right-2 -top-2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-primary-foreground"
            // The count is already in the button's accessible name; announcing
            // it twice makes the label read "3 3 items".
            aria-hidden="true"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>

      {hasItems && (
        <span className="hidden text-sm font-semibold tabular-nums text-gold sm:inline">
          {formatMoney(totals.totalCents)}
        </span>
      )}
    </button>
  );
}
