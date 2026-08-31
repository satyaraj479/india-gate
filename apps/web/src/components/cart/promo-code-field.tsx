"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Tag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/store/cart-store";
import { formatMoney } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Promo code entry.
 *
 * Codes are uppercased as the guest types, because they arrive from posters
 * and SMS in mixed case and "gate15" failing is indistinguishable from an
 * expired code. Rejection messages say what to do — "spend S$6.20 more" rather
 * than "invalid code" — since almost every rejection here is a threshold the
 * guest can still meet.
 */
export function PromoCodeField() {
  const coupon = useCartStore((s) => s.coupon);
  const couponError = useCartStore((s) => s.couponError);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    // Mirrors the round trip the server-validated version will make, so the
    // control does not change behaviour when it goes live.
    await new Promise((r) => setTimeout(r, 260));
    const result = applyCoupon(code);
    if (result.ok) setCode("");
    setSubmitting(false);
  };

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-veg/30 bg-veg/[0.08] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Tag className="h-4 w-4 shrink-0 text-veg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              <span className="font-mono text-veg">{coupon.code}</span> applied
            </p>
            <p className="truncate text-xs text-muted-foreground">{coupon.label}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-sm font-semibold tabular-nums text-veg">
            −{formatMoney(coupon.discountCents)}
          </span>
          <button
            type="button"
            onClick={removeCoupon}
            aria-label={`Remove promo code ${coupon.code}`}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Promo code"
            aria-label="Promo code"
            aria-invalid={Boolean(couponError)}
            aria-describedby={couponError ? "promo-error" : undefined}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            className={cn(
              "h-10 pl-9 font-mono text-sm uppercase tracking-wider",
              couponError && "border-destructive/60",
            )}
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={!code.trim() || submitting}
          className="h-10 shrink-0"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>

      <div aria-live="polite">
        {couponError && (
          <p id="promo-error" className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {couponError.message}
          </p>
        )}
      </div>
    </form>
  );
}
