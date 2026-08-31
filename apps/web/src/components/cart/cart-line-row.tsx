"use client";

import { DietaryMark } from "@/components/menu/dietary-mark";
import { DishImage } from "@/components/menu/dish-image";
import { QuantityStepper } from "./quantity-stepper";
import { useCartStore } from "@/store/cart-store";
import { formatMoney } from "@/lib/pricing";
import type { CartItem } from "@/types/cart";
import { lineTotalCents, unitPriceCents } from "@/types/cart";

/**
 * One cart line.
 *
 * Modifiers are itemised with their own prices rather than folded into a
 * single line total. A guest who sees "Masala Dosa — S$11.60" and paid S$8.90
 * on the menu page assumes a bug; showing "+ Ghee roast S$1.80, + Extra sambar
 * S$1.50" is the difference between a trusted total and an abandoned cart.
 * Free selections (spice level) are listed too, without a price, because they
 * are what the kitchen will actually cook.
 */
export function CartLineRow({ item }: { item: CartItem }) {
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);

  const paidModifiers = item.selections.filter((s) => s.priceDeltaCents !== 0);
  const freeModifiers = item.selections.filter((s) => s.priceDeltaCents === 0);

  return (
    <li className="flex gap-3 py-4">
      <DishImage
        src={item.imageUrl}
        name={item.dishName}
        sizes="64px"
        className="h-16 w-16 shrink-0 rounded-md"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-medium leading-snug">
              <DietaryMark type={item.dietaryType} size={12} />
              <span className="truncate">{item.dishName}</span>
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatMoney(unitPriceCents(item))} each
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatMoney(lineTotalCents(item))}
          </span>
        </div>

        {(freeModifiers.length > 0 || paidModifiers.length > 0) && (
          <ul className="mt-2 space-y-0.5 border-l border-white/10 pl-2.5 text-xs">
            {freeModifiers.map((m) => (
              <li key={m.optionId} className="text-muted-foreground">
                {m.optionName}
              </li>
            ))}
            {paidModifiers.map((m) => (
              <li
                key={m.optionId}
                className="flex justify-between gap-2 text-muted-foreground"
              >
                <span className="truncate">+ {m.optionName}</span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(m.priceDeltaCents)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {item.specialInstructions && (
          <p className="mt-2 rounded border border-gold/20 bg-gold/[0.06] px-2 py-1 text-xs italic text-gold-400/90">
            “{item.specialInstructions}”
          </p>
        )}

        <div className="mt-2.5">
          <QuantityStepper
            quantity={item.quantity}
            itemName={item.dishName}
            onIncrement={() => increment(item.lineId)}
            onDecrement={() => decrement(item.lineId)}
            size="sm"
          />
        </div>
      </div>
    </li>
  );
}
