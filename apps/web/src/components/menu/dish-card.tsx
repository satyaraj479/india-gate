"use client";

import { Plus, Settings2, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DietaryMark } from "./dietary-mark";
import { DishImage } from "./dish-image";
import { SpiceBadge } from "./spice-badge";
import { useCartStore } from "@/store/cart-store";
import { formatMoney } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { DISH_TAG_LABEL, type Dish, type ModifierGroup } from "@/types/catalog";

/**
 * Menu card.
 *
 * The primary action changes with the dish: a dish with required modifiers
 * gets "Customise", one without gets a single-tap "Add". Routing every dish
 * through a dialog to confirm nothing costs two taps on a garlic naan and is
 * the fastest way to make a menu feel slow.
 */
export function DishCard({
  dish,
  modifierGroups,
  onCustomise,
  priority = false,
}: {
  dish: Dish;
  modifierGroups: ModifierGroup[];
  onCustomise: (dish: Dish) => void;
  priority?: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const needsCustomisation = modifierGroups.some((g) => g.isRequired);
  const hasOptions = modifierGroups.length > 0;
  const discounted =
    dish.compareAtPriceCents !== null &&
    dish.compareAtPriceCents > dish.basePriceCents;

  const quickAdd = () => {
    addItem({
      dishId: dish.id,
      dishSlug: dish.slug,
      dishName: dish.name,
      imageUrl: dish.imageUrl,
      dietaryType: dish.dietaryType,
      spiceLevel: dish.spiceLevel,
      categorySlug: dish.categorySlug,
      unitBasePriceCents: dish.basePriceCents,
      quantity: 1,
      selections: [],
      specialInstructions: null,
    });
    toast.success(`${dish.name} added`, {
      action: { label: "View cart", onClick: openCart },
    });
  };

  return (
    <article
      className={cn(
        "surface group relative flex gap-4 p-4 transition-all duration-300",
        dish.isAvailable
          ? "hover:border-gold/25 hover:shadow-lift"
          : "opacity-60 saturate-[0.4]",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <DietaryMark type={dish.dietaryType} />
          <h3 className="text-[15px] font-medium leading-snug">{dish.name}</h3>
        </div>

        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {dish.shortDescription}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <SpiceBadge level={dish.spiceLevel} />
          {dish.rating && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-gold text-gold" />
              <span className="font-medium text-foreground/90">
                {dish.rating.average.toFixed(1)}
              </span>
              <span>({dish.rating.count})</span>
            </span>
          )}
          {dish.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant={tag === "BESTSELLER" || tag === "CHEFS_SPECIAL" ? "default" : "muted"}
            >
              {DISH_TAG_LABEL[tag]}
            </Badge>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[15px] font-semibold text-foreground">
            {formatMoney(dish.basePriceCents)}
          </span>
          {discounted && (
            <span className="text-xs text-muted-foreground line-through">
              {formatMoney(dish.compareAtPriceCents!)}
            </span>
          )}
          {hasOptions && dish.isAvailable && (
            <span className="text-xs text-muted-foreground">· customisable</span>
          )}
        </div>
      </div>

      <div className="flex w-[110px] shrink-0 flex-col gap-2 sm:w-[128px]">
        <DishImage
          src={dish.imageUrl}
          name={dish.name}
          priority={priority}
          sizes="(min-width: 640px) 128px, 110px"
          className="aspect-[4/3] w-full rounded-lg"
        />

        {dish.isAvailable ? (
          needsCustomisation || hasOptions ? (
            <Button
              size="sm"
              variant={needsCustomisation ? "default" : "outline"}
              onClick={() => onCustomise(dish)}
              className="w-full"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Customise
            </Button>
          ) : (
            <Button size="sm" onClick={quickAdd} className="w-full">
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          )
        ) : (
          <div className="rounded-md border border-white/10 bg-navy-900/70 px-2 py-1.5 text-center">
            <p className="text-[11px] font-medium text-muted-foreground">Sold out</p>
            {dish.unavailableUntilLabel && (
              <p className="text-[10px] leading-tight text-muted-foreground/70">
                {dish.unavailableUntilLabel}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
