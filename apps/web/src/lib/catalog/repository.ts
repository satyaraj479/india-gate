import "server-only";

import type { Dish, MenuDocument } from "@/types/catalog";
import { MENU_DOCUMENT } from "./local-catalog";

/**
 * The seam between this app and wherever the menu actually lives.
 *
 * Every server component imports `getMenuRepository()`, never a concrete
 * implementation. Moving from the bundled catalog to the NestJS API is one
 * environment variable and zero component changes — which is the whole reason
 * the interface exists rather than components calling `fetch` directly.
 *
 * `server-only` is not decoration: it makes the build fail if a client
 * component ever imports this module, which is what stops the entire catalog
 * (and, later, an API token) being serialised into the browser bundle by
 * accident.
 */
export interface MenuRepository {
  getMenu(): Promise<MenuDocument>;
  getDishBySlug(slug: string): Promise<Dish | null>;
}

class LocalMenuRepository implements MenuRepository {
  async getMenu(): Promise<MenuDocument> {
    return MENU_DOCUMENT;
  }

  async getDishBySlug(slug: string): Promise<Dish | null> {
    return MENU_DOCUMENT.dishes.find((d) => d.slug === slug) ?? null;
  }
}

/**
 * Reads the same `MenuDocument` shape from the platform API. The response is
 * cached at the Next.js data layer with a tag, so publishing a menu change
 * revalidates every page that rendered it rather than waiting out a TTL.
 */
class ApiMenuRepository implements MenuRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly outletId: string,
  ) {}

  async getMenu(): Promise<MenuDocument> {
    const res = await fetch(
      `${this.baseUrl}/outlets/${this.outletId}/menu?channel=DELIVERY`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60, tags: ["menu", `menu:${this.outletId}`] },
      },
    );

    if (!res.ok) {
      // Fail loudly on the server rather than rendering an empty menu — an
      // empty menu looks like a closed restaurant and costs orders silently.
      throw new Error(
        `Menu fetch failed: ${res.status} ${res.statusText} for outlet ${this.outletId}`,
      );
    }
    return (await res.json()) as MenuDocument;
  }

  async getDishBySlug(slug: string): Promise<Dish | null> {
    const menu = await this.getMenu();
    return menu.dishes.find((d) => d.slug === slug) ?? null;
  }
}

let cached: MenuRepository | null = null;

export const getMenuRepository = (): MenuRepository => {
  if (cached) return cached;

  const baseUrl = process.env.MENU_API_URL;
  const outletId = process.env.NEXT_PUBLIC_OUTLET_ID;

  cached =
    baseUrl && outletId
      ? new ApiMenuRepository(baseUrl, outletId)
      : new LocalMenuRepository();

  return cached;
};
