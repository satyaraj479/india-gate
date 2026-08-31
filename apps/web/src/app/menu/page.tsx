import type { Metadata } from "next";

import { MenuBrowser } from "@/components/menu/menu-browser";
import { getMenuRepository } from "@/lib/catalog/repository";
import { formatMoney } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Online Menu",
  description:
    "Order dosai, Hyderabadi dum biryani, Chettinad gravies, breads, desserts and filter kaapi for delivery or self-pickup across Singapore.",
  alternates: { canonical: "/menu" },
};

/**
 * The menu is a server component so every dish name, description and price is
 * in the initial HTML. This page is the site's main organic entry point;
 * rendering it client-side would hand search engines an empty div and lose the
 * traffic the whole business runs on.
 *
 * `revalidate` matters once the API repository is in play — the bundled
 * catalog is static, but the same page then re-fetches hourly and is
 * invalidated on demand by the `menu` cache tag when the kitchen publishes a
 * change.
 */
export const revalidate = 3600;

export default async function MenuPage() {
  const menu = await getMenuRepository().getMenu();

  const availableCount = menu.dishes.filter((d) => d.isAvailable).length;
  const cheapest = Math.min(...menu.dishes.map((d) => d.basePriceCents));

  // Menu structured data, so the dish list can surface directly in search.
  const menuJsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `${menu.outletName} menu`,
    hasMenuSection: menu.categories.map((category) => ({
      "@type": "MenuSection",
      name: category.name,
      description: category.tagline,
      hasMenuItem: menu.dishes
        .filter((d) => d.categorySlug === category.slug)
        .map((dish) => ({
          "@type": "MenuItem",
          name: dish.name,
          description: dish.shortDescription,
          offers: {
            "@type": "Offer",
            price: (dish.basePriceCents / 100).toFixed(2),
            priceCurrency: menu.currency,
            availability: dish.isAvailable
              ? "https://schema.org/InStock"
              : "https://schema.org/SoldOut",
          },
          suitableForDiet:
            dish.dietaryType === "VEG"
              ? "https://schema.org/VegetarianDiet"
              : undefined,
        })),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />

      <div className="border-b border-white/[0.06] bg-navy-950/30">
        <div className="container py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold/80">
            {menu.outletName}
          </p>
          <h1 className="heading-serif mt-2 text-4xl font-semibold sm:text-5xl">
            The <span className="text-gradient-gold">Online Menu</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {availableCount} dishes available today, from {formatMoney(cheapest)}.
            Batter ground each morning, biryani sealed under dough at four, and
            every gravy made the same week you eat it.
          </p>
        </div>
      </div>

      <MenuBrowser document={menu} />
    </>
  );
}
