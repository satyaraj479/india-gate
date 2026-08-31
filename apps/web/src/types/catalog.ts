/**
 * Catalog types.
 *
 * All money is an integer number of cents. There is no `price: number` in
 * this codebase without a `Cents` suffix — see `@indiagate/core/money` for
 * the arithmetic helpers and the reasoning.
 */

export type DietaryType = "VEG" | "NON_VEG" | "EGG";

export type SpiceLevel = "NONE" | "MILD" | "MEDIUM" | "SPICY" | "EXTRA_SPICY";

export type DishTag =
  | "BESTSELLER"
  | "CHEFS_SPECIAL"
  | "NEW"
  | "JAIN_AVAILABLE"
  | "GLUTEN_FREE"
  | "CONTAINS_NUTS"
  | "CONTAINS_DAIRY";

export type CategorySlug =
  | "tiffins"
  | "biryani"
  | "curries"
  | "breads"
  | "desserts"
  | "beverages";

export interface Category {
  id: string;
  slug: CategorySlug;
  name: string;
  /** Rendered under the section heading on the menu page. */
  tagline: string;
  /** Lucide icon name, resolved by the category rail. */
  icon: string;
  sortOrder: number;
}

/**
 * A modifier group is defined once and attached to many dishes. "Spice Level"
 * belongs to thirty curries; inlining it thirty times triples the menu payload
 * and guarantees that someone edits one copy and not the others.
 */
export type ModifierSelectionType = "SINGLE" | "MULTI";

export interface ModifierOption {
  id: string;
  name: string;
  description?: string;
  /**
   * Signed. "No onion" is 0, "Extra ghee roast" is +150, and a downgrade can
   * legitimately be negative.
   */
  priceDeltaCents: number;
  isDefault: boolean;
  isAvailable: boolean;
  dietaryType?: DietaryType;
}

export interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  selectionType: ModifierSelectionType;
  /** A required group blocks "Add to cart" until it is satisfied. */
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface Dish {
  id: string;
  slug: string;
  name: string;
  /** One line on the card. */
  shortDescription: string;
  /** Full copy in the customise dialog. */
  description: string;
  categorySlug: CategorySlug;
  imageUrl: string | null;

  dietaryType: DietaryType;
  spiceLevel: SpiceLevel;
  tags: DishTag[];

  basePriceCents: number;
  /** Struck through when present and higher than the base price. */
  compareAtPriceCents: number | null;

  servesPax: number;
  calories: number | null;
  allergens: string[];

  isAvailable: boolean;
  /** Shown in place of the price when unavailable, e.g. "Back at 5:00 PM". */
  unavailableUntilLabel: string | null;

  modifierGroupIds: string[];
  sortOrder: number;
  rating: { average: number; count: number } | null;
}

/**
 * The menu is fetched as one document with modifier groups normalised out.
 * Both the local catalog and the API adapter return exactly this shape, which
 * is what makes them swappable.
 */
export interface MenuDocument {
  outletId: string;
  outletName: string;
  currency: string;
  generatedAt: string;
  categories: Category[];
  dishes: Dish[];
  modifierGroups: ModifierGroup[];
}

/** Convenience view built once on the client, keyed for O(1) lookup. */
export interface MenuIndex {
  document: MenuDocument;
  dishById: ReadonlyMap<string, Dish>;
  modifierGroupById: ReadonlyMap<string, ModifierGroup>;
  dishesByCategory: ReadonlyMap<CategorySlug, Dish[]>;
}

export const buildMenuIndex = (document: MenuDocument): MenuIndex => {
  const dishById = new Map(document.dishes.map((d) => [d.id, d]));
  const modifierGroupById = new Map(document.modifierGroups.map((g) => [g.id, g]));
  const dishesByCategory = new Map<CategorySlug, Dish[]>();

  for (const category of document.categories) {
    dishesByCategory.set(
      category.slug,
      document.dishes
        .filter((d) => d.categorySlug === category.slug)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  return { document, dishById, modifierGroupById, dishesByCategory };
};

export const resolveModifierGroups = (
  dish: Dish,
  index: Pick<MenuIndex, "modifierGroupById">,
): ModifierGroup[] =>
  dish.modifierGroupIds
    .map((id) => index.modifierGroupById.get(id))
    .filter((g): g is ModifierGroup => g !== undefined);

// -- Display helpers ---------------------------------------------------------

export const SPICE_LEVEL_LABEL: Record<SpiceLevel, string> = {
  NONE: "Not spicy",
  MILD: "Mild",
  MEDIUM: "Medium",
  SPICY: "Spicy",
  EXTRA_SPICY: "Extra spicy",
};

/** Chilli glyph count, so the badge scales with heat rather than just naming it. */
export const SPICE_LEVEL_HEAT: Record<SpiceLevel, number> = {
  NONE: 0,
  MILD: 1,
  MEDIUM: 2,
  SPICY: 3,
  EXTRA_SPICY: 4,
};

export const DISH_TAG_LABEL: Record<DishTag, string> = {
  BESTSELLER: "Bestseller",
  CHEFS_SPECIAL: "Chef's special",
  NEW: "New",
  JAIN_AVAILABLE: "Jain available",
  GLUTEN_FREE: "Gluten free",
  CONTAINS_NUTS: "Contains nuts",
  CONTAINS_DAIRY: "Contains dairy",
};
