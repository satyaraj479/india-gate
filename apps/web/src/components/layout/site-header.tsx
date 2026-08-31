"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, MapPin, Menu, Phone, X } from "lucide-react";

import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { CartTrigger } from "./cart-trigger";
import { FulfilmentToggle } from "./fulfilment-toggle";
import { NAV_LINKS, OUTLET } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useFulfilmentStore } from "@/store/fulfilment-store";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Sticky header.
 *
 * Two rows on desktop — brand and navigation above, fulfilment context below —
 * because the delivery/takeaway choice and the destination address are
 * persistent state the guest needs to see while browsing, not a one-time
 * checkout question. Collapsing them into a single row is what forces the
 * address into a modal nobody reopens.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const mode = useFulfilmentStore((s) => s.mode);
  const deliveryLocation = useFulfilmentStore((s) => s.deliveryLocation);
  const openValidator = useFulfilmentStore((s) => s.openValidator);
  const hydrated = useHydrated();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on navigation. Without this it stays open over the
  // new page, which reads as a broken link.
  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const locationLabel = !hydrated
    ? "Set your location"
    : mode === "TAKEAWAY"
      ? `Pickup · ${OUTLET.addressLine1}`
      : deliveryLocation
        ? `${deliveryLocation.postalCode} · ${deliveryLocation.areaName}`
        : "Add your delivery address";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        scrolled
          ? "border-b border-white/[0.08] bg-navy-950/90 backdrop-blur-xl"
          : "border-b border-transparent bg-navy-900/60 backdrop-blur-sm",
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="India Gate, home" className="shrink-0">
          <BrandLogo />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "text-gold"
                      : "text-foreground/75 hover:text-foreground",
                  )}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-px bg-gold-sheen" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <FulfilmentToggle className="hidden md:flex" />
          <CartTrigger />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="rounded-full border border-white/10 bg-navy-800/80 p-2.5 text-foreground/80 transition-colors hover:text-foreground lg:hidden"
          >
            {mobileOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>

      {/* Fulfilment context bar */}
      <div className="border-t border-white/[0.06] bg-navy-950/40">
        <div className="container flex h-11 items-center justify-between gap-3">
          <button
            type="button"
            onClick={openValidator}
            className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gold/80" />
            <span className="truncate">{locationLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </button>

          <div className="flex items-center gap-4">
            {hydrated && mode === "DELIVERY" && deliveryLocation && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Arriving in about{" "}
                <span className="font-medium text-foreground">
                  {deliveryLocation.etaMinutes} min
                </span>
              </span>
            )}
            <a
              href={`tel:${OUTLET.phone.replace(/\s/g, "")}`}
              className="hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-gold sm:flex"
            >
              <Phone className="h-3.5 w-3.5" />
              {OUTLET.phoneDisplay}
            </a>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="border-t border-white/[0.08] bg-navy-950/95 backdrop-blur-xl lg:hidden"
        >
          <nav aria-label="Mobile" className="container py-3">
            <ul className="space-y-0.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-3 text-sm font-medium transition-colors",
                      isActive(link.href)
                        ? "bg-gold/10 text-gold"
                        : "text-foreground/80 hover:bg-white/[0.05]",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
              <FulfilmentToggle />
              <Button asChild size="sm" variant="outline">
                <a href={`tel:${OUTLET.phone.replace(/\s/g, "")}`}>
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
