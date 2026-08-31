"use client";

import { Minus, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Quantity control.
 *
 * At quantity 1 the minus button becomes a bin: decrementing to zero is what
 * guests reach for when they want a line gone, and hiding removal behind a
 * separate icon means they clear the whole cart instead. The button's
 * accessible name changes with it, so the swap is announced rather than
 * silently altering what the control does.
 */
export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  itemName,
  max = 99,
  size = "default",
}: {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  itemName: string;
  max?: number;
  size?: "default" | "sm";
}) {
  const willRemove = quantity <= 1;
  const dimension = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-white/12 bg-navy-900/70",
        size === "sm" ? "gap-0.5 p-0.5" : "gap-1 p-1",
      )}
    >
      <button
        type="button"
        onClick={onDecrement}
        aria-label={willRemove ? `Remove ${itemName}` : `Decrease ${itemName} quantity`}
        className={cn(
          dimension,
          "flex items-center justify-center rounded-full transition-colors",
          willRemove
            ? "text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            : "text-foreground/80 hover:bg-white/10 hover:text-foreground",
        )}
      >
        {willRemove ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      </button>

      <span
        className={cn(
          "min-w-[1.5rem] text-center font-semibold tabular-nums",
          size === "sm" ? "text-xs" : "text-sm",
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="sr-only">{itemName} quantity: </span>
        {quantity}
      </span>

      <button
        type="button"
        onClick={onIncrement}
        disabled={quantity >= max}
        aria-label={`Increase ${itemName} quantity`}
        className={cn(
          dimension,
          "flex items-center justify-center rounded-full text-gold transition-colors",
          "hover:bg-gold/15 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
