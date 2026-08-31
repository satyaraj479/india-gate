"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2, MapPin, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useFulfilmentStore } from "@/store/fulfilment-store";
import { normalisePostalCode, type ServiceabilityResult } from "@/lib/serviceability";
import { formatMoney } from "@/lib/pricing";
import { OUTLET } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Address / postcode validator.
 *
 * Two steps in one dialog rather than two screens: check the postcode, then —
 * only once it is serviceable — collect the street address. Asking for a full
 * address before knowing whether we deliver there wastes the guest's time and
 * is the single most common drop-off point in a food ordering flow.
 *
 * The check runs against the local zone table. Against the platform API it
 * becomes `POST /outlets/{id}/serviceability`; the artificial delay below is
 * what keeps the two feeling identical, so the component does not need
 * rewriting when the call becomes real.
 */
export function ServiceabilityModal() {
  const isOpen = useFulfilmentStore((s) => s.isValidatorOpen);
  const closeValidator = useFulfilmentStore((s) => s.closeValidator);
  const validateAndSetPostcode = useFulfilmentStore((s) => s.validateAndSetPostcode);
  const completeAddress = useFulfilmentStore((s) => s.completeAddress);
  const setMode = useFulfilmentStore((s) => s.setMode);
  const deliveryLocation = useFulfilmentStore((s) => s.deliveryLocation);

  const [postcode, setPostcode] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ServiceabilityResult | null>(null);
  const [addressLine1, setAddressLine1] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [addressTouched, setAddressTouched] = useState(false);

  // Re-seed from the store each time the dialog opens so a guest editing a
  // saved address sees what they already gave us.
  useEffect(() => {
    if (!isOpen) return;
    setPostcode(deliveryLocation?.postalCode ?? "");
    setAddressLine1(deliveryLocation?.addressLine1 ?? "");
    setUnitNumber(deliveryLocation?.unitNumber ?? "");
    setNotes(deliveryLocation?.deliveryNotes ?? "");
    setResult(null);
    setAddressTouched(false);
  }, [isOpen, deliveryLocation]);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    // Matches the latency of the real endpoint closely enough that the
    // spinner is not a lie and the layout does not jump when it goes live.
    await new Promise((r) => setTimeout(r, 320));
    setResult(validateAndSetPostcode(postcode));
    setChecking(false);
  };

  const confirmAddress = () => {
    setAddressTouched(true);
    if (addressLine1.trim().length < 3) return;
    completeAddress({
      addressLine1: addressLine1.trim(),
      unitNumber: unitNumber.trim() || null,
      deliveryNotes: notes.trim() || null,
    });
    toast.success("Delivering to " + postcode, {
      description: result?.deliverable
        ? `${result.zone.name} · about ${result.zone.etaMinutes} minutes`
        : undefined,
    });
  };

  const switchToTakeaway = () => {
    setMode("TAKEAWAY");
    closeValidator();
    toast.success("Switched to self-pickup", {
      description: `${OUTLET.addressLine1}, ${OUTLET.addressLine2}`,
    });
  };

  const addressInvalid = addressTouched && addressLine1.trim().length < 3;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeValidator()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gold" />
            Where are we delivering?
          </DialogTitle>
          <DialogDescription>
            Enter your six-digit postcode and we will confirm the fee and the
            wait before you build your order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <div className="flex gap-2">
              <Input
                id="postcode"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="218123"
                maxLength={6}
                value={postcode}
                onChange={(e) => {
                  setPostcode(normalisePostalCode(e.target.value));
                  setResult(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && postcode.length === 6) void runCheck();
                }}
                aria-invalid={result?.deliverable === false}
                aria-describedby="postcode-result"
                className="font-mono tracking-[0.2em]"
              />
              <Button
                type="button"
                onClick={() => void runCheck()}
                disabled={postcode.length !== 6 || checking}
                className="shrink-0"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
              </Button>
            </div>
          </div>

          {/* Live region: the result is announced, not just shown. */}
          <div id="postcode-result" aria-live="polite">
            {result?.deliverable === false && (
              <div className="flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="space-y-2.5">
                  <p className="text-sm text-foreground/90">{result.message}</p>
                  {result.reason === "OUT_OF_RANGE" && (
                    <Button size="sm" variant="outline" onClick={switchToTakeaway}>
                      <ShoppingBag className="h-3.5 w-3.5" />
                      Switch to self-pickup
                    </Button>
                  )}
                </div>
              </div>
            )}

            {result?.deliverable && (
              <div className="space-y-1 rounded-md border border-veg/30 bg-veg/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-veg" />
                  We deliver to {result.zone.name}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    about {result.zone.etaMinutes} min
                  </span>
                  <span>
                    {result.zone.feeCents === 0
                      ? "Free delivery"
                      : `${formatMoney(result.zone.feeCents)} delivery`}
                  </span>
                  <span>Minimum {formatMoney(result.zone.minOrderCents)}</span>
                </p>
              </div>
            )}
          </div>

          {result?.deliverable && (
            <>
              <Separator />
              <div className="space-y-3 animate-fade-up">
                <div className="space-y-2">
                  <Label htmlFor="address-line-1">Street address</Label>
                  <Input
                    id="address-line-1"
                    autoComplete="address-line1"
                    placeholder="42 Serangoon Road"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    aria-invalid={addressInvalid}
                    aria-describedby={addressInvalid ? "address-error" : undefined}
                  />
                  {addressInvalid && (
                    <p id="address-error" className="text-xs text-destructive">
                      Please enter your street address.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">
                    Unit / floor{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="unit"
                    autoComplete="address-line2"
                    placeholder="#12-04"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">
                    Notes for the rider{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Lift lobby B, call on arrival"
                    maxLength={300}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[68px]"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div
          className={cn(
            "flex flex-col-reverse gap-2 border-t border-white/[0.07] p-4 sm:flex-row sm:justify-end",
          )}
        >
          <Button variant="ghost" onClick={closeValidator}>
            Cancel
          </Button>
          <Button onClick={confirmAddress} disabled={!result?.deliverable}>
            Save address
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
