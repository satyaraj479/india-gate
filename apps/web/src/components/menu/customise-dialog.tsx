"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DietaryMark } from "./dietary-mark";
import { DishImage } from "./dish-image";
import { SpiceBadge } from "./spice-badge";
import { useCartStore } from "@/store/cart-store";
import { formatMoney } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Dish, ModifierGroup } from "@/types/catalog";
import type { SelectedModifier } from "@/types/cart";

/**
 * Item customisation.
 *
 * The dialog renders entirely from the modifier-group data: a SINGLE group
 * becomes a radio group, MULTI becomes checkboxes capped at `maxSelections`,
 * and a required group blocks submission until satisfied. Adding a "Choose
 * your podi" group to forty dishes is a content change — no component here
 * knows what a chutney is.
 *
 * Three decisions that matter more than they look:
 *
 *  - Required groups that are unsatisfied are *not* silently blocked. Pressing
 *    Add scrolls to the first offender and marks it. A disabled button with no
 *    explanation is the single most common reason guests abandon a
 *    customisation sheet.
 *  - Checkboxes past the cap are disabled rather than hidden, with the cap
 *    stated in the group header, so the limit is discoverable before it is hit.
 *  - The footer price updates on every selection and includes the quantity, so
 *    the number on the button is exactly what lands in the cart.
 */
export function CustomiseDialog({
  dish,
  modifierGroups,
  open,
  onOpenChange,
}: {
  dish: Dish | null;
  modifierGroups: ModifierGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [attempted, setAttempted] = useState(false);

  // Reset to the group defaults each time a dish is opened. Carrying state
  // over from the previous dish is how a guest ends up with "Extra sambar" on
  // a mango lassi.
  useEffect(() => {
    if (!open || !dish) return;
    const defaults: Record<string, string[]> = {};
    for (const group of modifierGroups) {
      defaults[group.id] = group.options
        .filter((o) => o.isDefault && o.isAvailable)
        .map((o) => o.id);
    }
    setSelections(defaults);
    setQuantity(1);
    setInstructions("");
    setAttempted(false);
  }, [open, dish, modifierGroups]);

  const selectedModifiers: SelectedModifier[] = useMemo(() => {
    const out: SelectedModifier[] = [];
    for (const group of modifierGroups) {
      for (const optionId of selections[group.id] ?? []) {
        const option = group.options.find((o) => o.id === optionId);
        if (!option) continue;
        out.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDeltaCents: option.priceDeltaCents,
        });
      }
    }
    return out;
  }, [modifierGroups, selections]);

  const unitCents =
    (dish?.basePriceCents ?? 0) +
    selectedModifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);
  const totalCents = unitCents * quantity;

  const unsatisfied = useMemo(
    () =>
      modifierGroups.filter(
        (g) => g.isRequired && (selections[g.id]?.length ?? 0) < g.minSelections,
      ),
    [modifierGroups, selections],
  );

  const toggleSingle = (groupId: string, optionId: string) =>
    setSelections((prev) => ({ ...prev, [groupId]: [optionId] }));

  const toggleMulti = (group: ModifierGroup, optionId: string, checked: boolean) =>
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (checked) {
        if (current.length >= group.maxSelections) return prev;
        return { ...prev, [group.id]: [...current, optionId] };
      }
      return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
    });

  const submit = () => {
    if (!dish) return;
    setAttempted(true);

    const firstMissing = unsatisfied[0];
    if (firstMissing) {
      document
        .getElementById(`group-${firstMissing.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    addItem({
      dishId: dish.id,
      dishSlug: dish.slug,
      dishName: dish.name,
      imageUrl: dish.imageUrl,
      dietaryType: dish.dietaryType,
      spiceLevel: dish.spiceLevel,
      categorySlug: dish.categorySlug,
      unitBasePriceCents: dish.basePriceCents,
      quantity,
      selections: selectedModifiers,
      specialInstructions: instructions.trim() || null,
    });

    onOpenChange(false);
    toast.success(`${quantity} × ${dish.name} added`, {
      action: { label: "View cart", onClick: openCart },
    });
  };

  if (!dish) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-[540px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0">
        <DialogHeader className="space-y-0 p-0">
          <div className="flex gap-4 border-b border-white/[0.07] p-5 pr-12">
            <DishImage
              src={dish.imageUrl}
              name={dish.name}
              sizes="88px"
              className="h-[88px] w-[88px] shrink-0 rounded-lg"
            />
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="flex items-center gap-2 text-lg leading-snug">
                <DietaryMark type={dish.dietaryType} />
                {dish.name}
              </DialogTitle>
              <DialogDescription className="line-clamp-2 text-xs leading-relaxed">
                {dish.description}
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-sm font-semibold text-gold">
                  {formatMoney(dish.basePriceCents)}
                </span>
                <SpiceBadge level={dish.spiceLevel} />
                {dish.calories !== null && (
                  <span className="text-xs text-muted-foreground">
                    {dish.calories} kcal
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Only this region scrolls; the price footer stays put. */}
        <div className="min-h-0 overflow-y-auto px-5 py-1">
          {modifierGroups.map((group) => {
            const selected = selections[group.id] ?? [];
            const missing = attempted && group.isRequired && selected.length < group.minSelections;
            const atCap = group.selectionType === "MULTI" && selected.length >= group.maxSelections;

            return (
              <fieldset
                key={group.id}
                id={`group-${group.id}`}
                className="scroll-mt-4 border-b border-white/[0.07] py-4 last:border-0"
              >
                <legend className="mb-2.5 flex w-full items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{group.name}</span>
                    {group.isRequired ? (
                      <Badge variant={missing ? "nonveg" : "muted"}>Required</Badge>
                    ) : (
                      <Badge variant="muted">Optional</Badge>
                    )}
                  </span>
                  {group.selectionType === "MULTI" && (
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        atCap ? "text-gold" : "text-muted-foreground",
                      )}
                    >
                      {selected.length} of {group.maxSelections}
                    </span>
                  )}
                </legend>

                {group.description && (
                  <p className="-mt-1 mb-2.5 text-xs text-muted-foreground">
                    {group.description}
                  </p>
                )}

                {missing && (
                  <p className="mb-2.5 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Choose {group.minSelections === 1 ? "an option" : `${group.minSelections} options`} to continue.
                  </p>
                )}

                {group.selectionType === "SINGLE" ? (
                  <RadioGroup
                    value={selected[0] ?? ""}
                    onValueChange={(value) => toggleSingle(group.id, value)}
                    className="gap-1"
                  >
                    {group.options.map((option) => (
                      <OptionRow
                        key={option.id}
                        id={option.id}
                        name={option.name}
                        description={option.description}
                        priceDeltaCents={option.priceDeltaCents}
                        disabled={!option.isAvailable}
                        checked={selected.includes(option.id)}
                        control={
                          <RadioGroupItem
                            value={option.id}
                            id={option.id}
                            disabled={!option.isAvailable}
                          />
                        }
                      />
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="grid gap-1">
                    {group.options.map((option) => {
                      const checked = selected.includes(option.id);
                      const blocked = !option.isAvailable || (atCap && !checked);
                      return (
                        <OptionRow
                          key={option.id}
                          id={option.id}
                          name={option.name}
                          description={option.description}
                          priceDeltaCents={option.priceDeltaCents}
                          disabled={blocked}
                          checked={checked}
                          control={
                            <Checkbox
                              id={option.id}
                              checked={checked}
                              disabled={blocked}
                              onCheckedChange={(value) =>
                                toggleMulti(group, option.id, value === true)
                              }
                            />
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </fieldset>
            );
          })}

          <div className="space-y-2 py-4">
            <Label htmlFor="dish-instructions">
              Anything for the kitchen?{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="dish-instructions"
              placeholder="No curry leaves, please"
              maxLength={300}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-[64px]"
            />
            <p className="text-right text-xs text-muted-foreground">
              {instructions.length}/300
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.07] bg-navy-800/60 p-4">
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-navy-900/70 p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span
              className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums"
              aria-live="polite"
            >
              <span className="sr-only">Quantity: </span>
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              disabled={quantity >= 20}
              aria-label="Increase quantity"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gold transition-colors hover:bg-gold/15 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            size="lg"
            onClick={submit}
            className="h-11 flex-1 justify-between"
            // Deliberately not disabled while a required group is unsatisfied —
            // pressing it is what reveals which group needs attention.
            aria-describedby={unsatisfied.length > 0 ? "customise-blocked" : undefined}
          >
            <span>Add to cart</span>
            <span className="tabular-nums">{formatMoney(totalCents)}</span>
          </Button>
          {unsatisfied.length > 0 && (
            <p id="customise-blocked" className="sr-only">
              {unsatisfied.length} required{" "}
              {unsatisfied.length === 1 ? "choice is" : "choices are"} still needed.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OptionRow({
  id,
  name,
  description,
  priceDeltaCents,
  disabled,
  checked,
  control,
}: {
  id: string;
  name: string;
  description?: string;
  priceDeltaCents: number;
  disabled: boolean;
  checked: boolean;
  control: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
        checked && "bg-gold/[0.07]",
        disabled ? "opacity-45" : "hover:bg-white/[0.04]",
      )}
    >
      {control}
      <Label
        htmlFor={id}
        className={cn(
          "flex flex-1 items-center justify-between gap-3",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-normal">{name}</span>
          {description && (
            <span className="block truncate text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        {priceDeltaCents !== 0 && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-gold">
            {priceDeltaCents > 0 ? "+" : "−"}
            {formatMoney(Math.abs(priceDeltaCents))}
          </span>
        )}
      </Label>
    </div>
  );
}
