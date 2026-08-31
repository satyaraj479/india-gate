import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, PartyPopper, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatMoney } from "@/lib/pricing";
import { OUTLET } from "@/lib/config";

export const metadata: Metadata = {
  title: "Catering Bundles",
  description:
    "South Indian event catering in Singapore from 30 guests. Wedding, corporate and house-warming bundles with per-head pricing, course selection and full service.",
  alternates: { canonical: "/catering" },
};

/**
 * Catering bundles.
 *
 * A browsing and enquiry page rather than a self-serve checkout. Catering
 * involves a lead time, a deposit, a venue survey and a menu lock date — the
 * flow lives in the platform's catering wizard (`POST /catering/quote` and
 * `/catering/bookings` in the API contract), and this page's job is to
 * qualify the enquiry and set expectations on price and headcount before
 * anyone picks up a phone.
 */

const BUNDLES = [
  {
    id: "everyday",
    name: "Tiffin Table",
    tagline: "Breakfast and light functions",
    fromPerPaxCents: 1800,
    minimumPax: 30,
    leadTimeHours: 48,
    serviceStyle: "Drop-off",
    courses: [
      "Two tiffins — choose from dosai, idli, vadai, pongal",
      "Two chutneys and sambar",
      "One sweet",
      "Filter kaapi urn",
    ],
    popular: false,
  },
  {
    id: "deluxe",
    name: "Wedding Deluxe",
    tagline: "Full sit-down service",
    fromPerPaxCents: 2800,
    minimumPax: 50,
    leadTimeHours: 96,
    serviceStyle: "Buffet with staff",
    courses: [
      "Three starters",
      "One biryani, dum-sealed on site",
      "Three curries — veg and non-veg",
      "Breads, rice and accompaniments",
      "Two desserts",
      "Beverages and service staff",
    ],
    popular: true,
  },
  {
    id: "corporate",
    name: "Corporate Lunch",
    tagline: "Office floors and town halls",
    fromPerPaxCents: 2200,
    minimumPax: 40,
    leadTimeHours: 72,
    serviceStyle: "Buffet setup",
    courses: [
      "Two starters",
      "One biryani",
      "Two curries",
      "Breads and rice",
      "One dessert",
      "Disposable service ware",
    ],
    popular: false,
  },
];

const FAQ = [
  {
    q: "How far ahead do I need to book?",
    a: "Two days for the Tiffin Table, three for Corporate Lunch and four for Wedding Deluxe. Festival weekends fill six to eight weeks out, so book early for Deepavali and Pongal.",
  },
  {
    q: "Can I change the menu after booking?",
    a: "Yes, until the menu-lock date — 72 hours before the event. After that the kitchen has already bought the goods. Guest numbers can still move up by 10% inside that window.",
  },
  {
    q: "What deposit do you take?",
    a: "30% on confirmation, with the balance due the day before the event. The deposit is refundable up to 14 days out.",
  },
  {
    q: "Do you cater vegetarian and Jain menus?",
    a: "Every bundle has a fully vegetarian version, and Jain preparation (no onion, no garlic, no root vegetables) is available on request at no extra charge. Tell us at enquiry, not on the day.",
  },
  {
    q: "Do you provide staff and equipment?",
    a: "Chafing dishes, service ware and staff are add-ons on every bundle. A live dosai or appam counter needs a power point within ten metres and is priced per hour.",
  },
];

export default function CateringPage() {
  return (
    <>
      <section className="border-b border-white/[0.06] bg-navy-950/30">
        <div className="container py-14 sm:py-20">
          <Badge variant="default" className="mb-5 px-3 py-1">
            <PartyPopper className="h-3 w-3" />
            From 30 guests
          </Badge>
          <h1 className="heading-serif max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            Catering that tastes like the{" "}
            <span className="text-gradient-gold">restaurant</span>, not like a
            buffet
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            The same kitchen, the same stone-ground batter, the same handi. We
            cook on site where the venue allows it and seal the biryani in front
            of your guests. Weddings, house-warmings, corporate floors and
            funerals — we have done all four this month.
          </p>
        </div>
      </section>

      <section className="container py-14">
        <div className="grid gap-5 lg:grid-cols-3">
          {BUNDLES.map((bundle) => (
            <article
              key={bundle.id}
              className={`surface relative flex flex-col p-6 ${
                bundle.popular ? "border-gold/35 shadow-gold" : ""
              }`}
            >
              {bundle.popular && (
                <Badge variant="solid" className="absolute -top-2.5 left-6">
                  Most booked
                </Badge>
              )}

              <h2 className="heading-serif text-2xl font-semibold">{bundle.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{bundle.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground">from</span>
                <span className="heading-serif text-3xl font-semibold text-gold">
                  {formatMoney(bundle.fromPerPaxCents)}
                </span>
                <span className="text-sm text-muted-foreground">per guest</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-gold/70" />
                  {bundle.minimumPax} guests minimum
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gold/70" />
                  {bundle.leadTimeHours}h notice
                </span>
              </div>

              <div className="gold-rule my-5" />

              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold/80">
                {bundle.serviceStyle}
              </p>
              <ul className="flex-1 space-y-2.5">
                {bundle.courses.map((course) => (
                  <li key={course} className="flex gap-2.5 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-veg/80" />
                    <span className="text-muted-foreground">{course}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={bundle.popular ? "default" : "outline"}
                className="mt-6 w-full"
              >
                <Link href={`/contact?enquiry=catering&bundle=${bundle.id}`}>
                  Enquire about {bundle.name}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Per-head pricing steps down at 60 and 120 guests. Larger events and
          multi-day functions are quoted individually — call{" "}
          <a
            href={`tel:${OUTLET.phone.replace(/\s/g, "")}`}
            className="font-medium text-gold underline underline-offset-4"
          >
            {OUTLET.phoneDisplay}
          </a>
          .
        </p>
      </section>

      <section className="container pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="heading-serif mb-2 text-3xl font-semibold">
            Before you book
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            The questions we are asked on almost every enquiry call.
          </p>

          <Accordion type="single" collapsible className="surface px-5">
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}
