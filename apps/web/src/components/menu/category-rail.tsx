"use client";

import { useEffect, useRef } from "react";
import {
  CookingPot,
  CupSoda,
  Flame,
  IceCream2,
  Soup,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Category } from "@/types/catalog";

/**
 * Explicit map rather than `import * as Icons from "lucide-react"` and a
 * dynamic lookup. The namespace import defeats tree-shaking and pulls the
 * entire icon set — roughly 1,500 components — into the menu bundle. Measured
 * on this page it was the difference between a 308 kB and a 140 kB first load,
 * which on a 4G phone is a second of blank screen on the site's busiest route.
 *
 * A category whose icon is not listed falls back rather than crashing, so
 * adding one in the catalog cannot break the build.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Soup,
  Flame,
  CookingPot,
  Wheat,
  IceCream2,
  CupSoda,
};

/**
 * Sticky category jump links.
 *
 * Two behaviours make this feel right rather than merely functional:
 *
 *  1. The active chip is scrolled into view horizontally as the guest scrolls
 *     the page vertically. Without it, the rail on a phone shows "Tiffins"
 *     while the guest is three sections into Curries.
 *  2. Navigation is a real anchor, so the URL gains a hash, back works, and a
 *     shared link opens at the right section. `scroll-padding-top` in
 *     `globals.css` keeps the heading clear of this rail and the header.
 */
export function CategoryRail({
  categories,
  activeId,
  counts,
}: {
  categories: Category[];
  activeId: string | null;
  counts: Record<string, number>;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const chip = activeRef.current;
    if (!rail || !chip) return;

    const railBox = rail.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();

    // Only nudge when the chip is actually out of view; scrolling on every
    // change fights the guest's own horizontal swipes.
    if (chipBox.left < railBox.left + 12 || chipBox.right > railBox.right - 12) {
      rail.scrollTo({
        left: chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2,
        behavior: "smooth",
      });
    }
  }, [activeId]);

  return (
    <div className="sticky top-[6.75rem] z-30 -mx-4 border-y border-white/[0.07] bg-navy-950/85 backdrop-blur-xl sm:-mx-6 lg:-mx-8">
      <nav aria-label="Menu categories" className="container">
        <div
          ref={railRef}
          className="no-scrollbar flex gap-2 overflow-x-auto py-2.5"
        >
          {categories.map((category) => {
            const isActive = activeId === `section-${category.slug}`;
            const Icon = CATEGORY_ICONS[category.icon] ?? UtensilsCrossed;

            return (
              <a
                key={category.id}
                ref={isActive ? activeRef : undefined}
                href={`#section-${category.slug}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all",
                  isActive
                    ? "border-gold/50 bg-gold/12 text-gold"
                    : "border-white/10 bg-navy-800/60 text-muted-foreground hover:border-white/20 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {category.name}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10px] tabular-nums",
                    isActive ? "bg-gold/20" : "bg-white/[0.06]",
                  )}
                >
                  {counts[category.slug] ?? 0}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
