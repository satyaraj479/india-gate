/**
 * Commercial parameters.
 *
 * These are constants here because the app runs against a bundled catalog. In
 * the API-backed configuration every one of them arrives on the outlet object
 * — finance changes a delivery fee on a Tuesday afternoon and it must not
 * require a deploy. Keeping them in one file makes that swap mechanical.
 */

export const CURRENCY = "SGD";
export const LOCALE = "en-SG";

/** Singapore GST, in basis points. 900 = 9%. */
export const GST_RATE_BPS = 900;

/**
 * Menu prices are quoted GST-inclusive, which is the norm in Singapore. The
 * summary therefore *extracts* the tax for display rather than adding it on
 * top — adding it would overcharge every guest by 9%.
 */
export const PRICES_INCLUDE_GST = true;

export const PACKAGING_FEE_CENTS = 60;
export const TAKEAWAY_PACKAGING_FEE_CENTS = 40;

export const DEFAULT_DELIVERY_FEE_CENTS = 499;
export const FREE_DELIVERY_ABOVE_CENTS = 6000;
export const MIN_DELIVERY_ORDER_CENTS = 2500;

/** Gate Points: 10 points per whole dollar of food value. */
export const POINTS_PER_DOLLAR = 10;

export const OUTLET = {
  name: "India Gate",
  tagline: "Little India, Singapore",
  addressLine1: "42 Serangoon Road",
  addressLine2: "#01-14",
  postalCode: "217800",
  phone: "+65 6291 4420",
  phoneDisplay: "+65 6291 4420",
  email: "hello@indiagate.sg",
  hours: [
    { days: "Monday – Thursday", time: "8:00 AM – 10:30 PM" },
    { days: "Friday – Saturday", time: "8:00 AM – 11:30 PM" },
    { days: "Sunday", time: "8:00 AM – 10:00 PM" },
  ],
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Online Menu" },
  { href: "/catering", label: "Catering Bundles" },
  { href: "/reservations", label: "Table Booking" },
  { href: "/contact", label: "Contact Us" },
] as const;
