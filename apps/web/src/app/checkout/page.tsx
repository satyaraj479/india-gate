import type { Metadata } from "next";

import { CheckoutClient } from "@/components/checkout/checkout-client";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your India Gate order.",
  // A checkout page in the index is a support burden and an SEO liability:
  // guests land on it from search with an empty cart and assume the site is
  // broken.
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
