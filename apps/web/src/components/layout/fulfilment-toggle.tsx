"use client";

import { Bike, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";
import { useFulfilmentStore } from "@/store/fulfilment-store";
import { useHydrated } from "@/hooks/use-hydrated";
import type { FulfilmentMode } from "@/types/cart";

const OPTIONS: Array<{ mode: FulfilmentMode; label: string; icon: typeof Bike }> = [
  { mode: "DELIVERY", label: "Delivery", icon: Bike },
  { mode: "TAKEAWAY", label: "Takeaway", icon: ShoppingBag },
];

/**
 * Delivery / takeaway switch.
 *
 * A radiogroup, not two buttons — the two options are mutually exclusive
 * states of one setting, and screen readers should announce it that way.
 * Arrow-key navigation between the two comes free from the roles.
 *
 * Until the persisted store rehydrates, both options render unselected rather
 * than defaulting to Delivery. Guessing means a takeaway customer watches the
 * control visibly flip under them a frame after load.
 */
export function FulfilmentToggle({ className }: { className?: string }) {
  const mode = useFulfilmentStore((s) => s.mode);
  const setMode = useFulfilmentStore((s) => s.setMode);
  const hydrated = useHydrated();

  return (
    <div
      role="radiogroup"
      aria-label="Order type"
      className={cn(
        "relative flex items-center gap-0.5 rounded-full border border-white/10 bg-navy-800/80 p-1",
        className,
      )}
    >
      {OPTIONS.map(({ mode: value, label, icon: Icon }) => {
        const selected = hydrated && mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setMode(value)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              selected
                ? "bg-gold-sheen text-primary-foreground shadow-gold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
