"use client";

import { useCallback, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CategoryRail } from "./category-rail";
import { CustomiseDialog } from "./customise-dialog";
import { DishCard } from "./dish-card";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { cn } from "@/lib/utils";
import {
  buildMenuIndex,
  resolveModifierGroups,
  type Dish,
  type MenuDocument,
} from "@/types/catalog";

type DietFilter = "ALL" | "VEG" | "NON_VEG";

/**
 * The menu page's interactive shell.
 *
 * The document arrives fully rendered from the server component — this
 * component adds filtering, the jump-link rail and the customise dialog on top
 * of markup that already exists in the HTML. That ordering matters: the menu
 * is the site's main organic landing page, so every dish name and description
 * must be in the server response, not fetched after hydration.
 */
export function MenuBrowser({ document: doc }: { document: MenuDocument }) {
  const index = useMemo(() => buildMenuIndex(doc), [doc]);

  const [query, setQuery] = useState("");
  const [diet, setDiet] = useState<DietFilter>("ALL");
  const [activeDish, setActiveDish] = useState<Dish | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openCustomise = useCallback((dish: Dish) => {
    setActiveDish(dish);
    setDialogOpen(true);
  }, []);

  const normalisedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const matches = (dish: Dish) => {
      if (diet === "VEG" && dish.dietaryType === "NON_VEG") return false;
      if (diet === "NON_VEG" && dish.dietaryType !== "NON_VEG") return false;
      if (!normalisedQuery) return true;
      return (
        dish.name.toLowerCase().includes(normalisedQuery) ||
        dish.shortDescription.toLowerCase().includes(normalisedQuery) ||
        dish.description.toLowerCase().includes(normalisedQuery)
      );
    };

    return doc.categories
      .map((category) => ({
        category,
        dishes: (index.dishesByCategory.get(category.slug) ?? []).filter(matches),
      }))
      .filter((section) => section.dishes.length > 0);
  }, [doc.categories, index, diet, normalisedQuery]);

  const sectionIds = useMemo(
    () => filtered.map((s) => `section-${s.category.slug}`),
    [filtered],
  );
  const activeSectionId = useScrollSpy(sectionIds);

  const counts = useMemo(
    () =>
      Object.fromEntries(filtered.map((s) => [s.category.slug, s.dishes.length])),
    [filtered],
  );

  const totalShown = filtered.reduce((n, s) => n + s.dishes.length, 0);
  const isFiltered = diet !== "ALL" || normalisedQuery.length > 0;

  const modifierGroupsFor = useCallback(
    (dish: Dish) => resolveModifierGroups(dish, index),
    [index],
  );

  return (
    <>
      {/* Search and dietary filters */}
      <div className="container pb-4 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dosai, biryani, chutney…"
              aria-label="Search the menu"
              className="h-11 pl-10 pr-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label="Dietary filter"
            className="flex items-center gap-1 rounded-full border border-white/10 bg-navy-800/60 p-1"
          >
            <SlidersHorizontal className="ml-2 mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {(
              [
                ["ALL", "All"],
                ["VEG", "Vegetarian"],
                ["NON_VEG", "Non-veg"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={diet === value}
                onClick={() => setDiet(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  diet === value
                    ? "bg-gold-sheen text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isFiltered && (
          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            Showing {totalShown} {totalShown === 1 ? "dish" : "dishes"}
            {normalisedQuery && <> matching “{query.trim()}”</>}
          </p>
        )}
      </div>

      {filtered.length > 0 && (
        <CategoryRail
          categories={filtered.map((s) => s.category)}
          activeId={activeSectionId}
          counts={counts}
        />
      )}

      <div className="container pb-16 pt-8">
        {filtered.length === 0 ? (
          <div className="surface mx-auto max-w-md p-10 text-center">
            <p className="heading-serif text-lg">Nothing matches that</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different spelling, or clear the filters to see the whole
              menu.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDiet("ALL");
              }}
              className="mt-4 text-sm font-medium text-gold underline underline-offset-4"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-14">
            {filtered.map(({ category, dishes }, sectionIndex) => (
              <section
                key={category.id}
                id={`section-${category.slug}`}
                aria-labelledby={`heading-${category.slug}`}
              >
                <header className="mb-5">
                  <div className="flex items-baseline gap-3">
                    <h2
                      id={`heading-${category.slug}`}
                      className="heading-serif text-2xl font-semibold sm:text-3xl"
                    >
                      {category.name}
                    </h2>
                    <Badge variant="outline">{dishes.length}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {category.tagline}
                  </p>
                  <div className="gold-rule mt-4" />
                </header>

                <div className="grid gap-3 lg:grid-cols-2">
                  {dishes.map((dish, i) => (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      modifierGroups={modifierGroupsFor(dish)}
                      onCustomise={openCustomise}
                      // Only the first row of the first section is above the
                      // fold; eager-loading the rest would fight LCP.
                      priority={sectionIndex === 0 && i < 2}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <CustomiseDialog
        dish={activeDish}
        modifierGroups={activeDish ? modifierGroupsFor(activeDish) : []}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
