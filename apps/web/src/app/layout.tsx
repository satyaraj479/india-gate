import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { ServiceabilityModal } from "@/components/layout/serviceability-modal";
import { OUTLET } from "@/lib/config";

import "./globals.css";

/**
 * Typography is set from `--font-sans` and `--font-display` in `globals.css`,
 * which resolve to platform faces rather than a downloaded webfont.
 *
 * That is a deliberate default, not an omission. It means the build is
 * hermetic (no network call at compile time, so CI cannot fail because Google
 * Fonts is slow), there is no third-party request at runtime, and there is no
 * font-swap layout shift to tune. To use a real webfont instead, add
 * `next/font/google` or `next/font/local` here and set the two variables from
 * its `.variable` output — the rest of the design already reads from those
 * tokens and nothing else changes. See the typography note in the README.
 */

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://indiagate.sg",
  ),
  title: {
    default: "India Gate — South Indian Kitchen, Little India Singapore",
    template: "%s · India Gate",
  },
  description:
    "Dosai ground fresh each morning, sealed-handi Hyderabadi biryani and Chettinad gravies. Order for delivery or self-pickup, book a table, or plan an event with our catering bundles.",
  keywords: [
    "South Indian restaurant Singapore",
    "Hyderabadi biryani delivery",
    "dosa Little India",
    "Indian catering Singapore",
  ],
  openGraph: {
    type: "website",
    locale: "en_SG",
    siteName: "India Gate",
    title: "India Gate — South Indian Kitchen",
    description:
      "Dosai, dum biryani and Chettinad gravies in Little India. Delivery, self-pickup, table booking and event catering.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A1128",
  width: "device-width",
  initialScale: 1,
  // Never lock zoom on a menu — guests routinely pinch to read allergens.
  maximumScale: 5,
};

/**
 * Restaurant structured data. The menu and catering pages are the site's main
 * organic entry points, and this is what earns the rich result for them.
 */
const restaurantJsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "India Gate",
  servesCuisine: ["South Indian", "Hyderabadi", "Chettinad"],
  priceRange: "$$",
  telephone: OUTLET.phone,
  email: OUTLET.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: `${OUTLET.addressLine1}, ${OUTLET.addressLine2}`,
    addressLocality: "Singapore",
    postalCode: OUTLET.postalCode,
    addressCountry: "SG",
  },
  acceptsReservations: true,
  hasMenu: "/menu",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-SG" className="dark" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <script
          type="application/ld+json"
          // Serialised server-side from a literal we control; no user input
          // reaches this string.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
        />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>

        {/*
          Both live at the root rather than inside the header. They are opened
          from the header, the menu page and the checkout page, and a portal
          owned by one of those would unmount its own trigger mid-transition.
        */}
        <CartDrawer />
        <ServiceabilityModal />

        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast:
                "!bg-navy-800 !border-white/10 !text-foreground !rounded-lg !shadow-lift",
              description: "!text-muted-foreground",
              actionButton: "!bg-gold !text-primary-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
