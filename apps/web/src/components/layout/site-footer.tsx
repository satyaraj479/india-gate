import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { BrandLogo } from "@/components/brand/logo";
import { NAV_LINKS, OUTLET } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/[0.07] bg-navy-950/60">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-1">
            <BrandLogo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Dosai ground each morning, biryani sealed under dough, and filter
              kaapi pulled the long way. Serving Little India since 2011.
            </p>
          </div>

          <nav aria-labelledby="footer-explore" className="space-y-3">
            <h2
              id="footer-explore"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-gold/80"
            >
              Explore
            </h2>
            <ul className="space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold/80">
              Visit us
            </h2>
            <address className="space-y-2.5 text-sm not-italic text-muted-foreground">
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" />
                <span>
                  {OUTLET.addressLine1}, {OUTLET.addressLine2}
                  <br />
                  Singapore {OUTLET.postalCode}
                </span>
              </p>
              <p className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" />
                <a
                  href={`tel:${OUTLET.phone.replace(/\s/g, "")}`}
                  className="transition-colors hover:text-gold"
                >
                  {OUTLET.phoneDisplay}
                </a>
              </p>
              <p className="flex gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" />
                <a
                  href={`mailto:${OUTLET.email}`}
                  className="transition-colors hover:text-gold"
                >
                  {OUTLET.email}
                </a>
              </p>
            </address>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold/80">
              Kitchen hours
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {OUTLET.hours.map((slot) => (
                <li key={slot.days} className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" />
                  <span>
                    <span className="block text-foreground/90">{slot.days}</span>
                    {slot.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="gold-rule my-9" />

        <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} India Gate. All rights reserved.</p>
          <ul className="flex gap-5">
            <li>
              <Link href="/privacy" className="transition-colors hover:text-gold">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="transition-colors hover:text-gold">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/allergens" className="transition-colors hover:text-gold">
                Allergen information
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
