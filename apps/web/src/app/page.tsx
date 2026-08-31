import Link from "next/link";
import {
  ArrowRight,
  Bike,
  CalendarDays,
  Clock,
  PartyPopper,
  Sparkles,
  Star,
  Utensils,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DishImage } from "@/components/menu/dish-image";
import { DietaryMark } from "@/components/menu/dietary-mark";
import { SpiceBadge } from "@/components/menu/spice-badge";
import { getMenuRepository } from "@/lib/catalog/repository";
import { formatMoney } from "@/lib/pricing";
import { OUTLET } from "@/lib/config";

export const revalidate = 3600;

export default async function HomePage() {
  const menu = await getMenuRepository().getMenu();

  const featured = menu.dishes
    .filter((d) => d.isAvailable && d.tags.includes("BESTSELLER"))
    .slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, hsl(46 65% 52%) 0 1px, transparent 1px 14px)",
          }}
        />

        <div className="container relative py-20 sm:py-28 lg:py-32">
          <div className="max-w-2xl">
            <Badge variant="default" className="mb-5 px-3 py-1">
              <Sparkles className="h-3 w-3" />
              Serving Little India since 2011
            </Badge>

            <h1 className="heading-serif text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
              Batter ground at dawn.
              <br />
              <span className="text-gradient-gold">Biryani sealed at four.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Dosai spread on cast iron, Hyderabadi dum under a dough seal, and
              Chettinad masala roasted the morning you eat it. Order in, collect
              at the counter, book a table, or let us cater the whole evening.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/menu">
                  <Utensils className="h-4 w-4" />
                  Order now
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/reservations">
                  <CalendarDays className="h-4 w-4" />
                  Book a table
                </Link>
              </Button>
            </div>

            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
              <Stat icon={Clock} value="30 min" label="Average delivery" />
              <Stat icon={Star} value="4.8 / 5" label="Over 2,400 reviews" />
              <Stat icon={Bike} value="Islandwide" label="Five delivery zones" />
            </dl>
          </div>
        </div>
      </section>

      {/* Three ways to order */}
      <section className="container py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <PathCard
            href="/menu"
            icon={Utensils}
            title="A la carte"
            body="The full menu, delivered across Singapore or ready at the counter in twenty minutes."
            cta="Browse the menu"
          />
          <PathCard
            href="/catering"
            icon={PartyPopper}
            title="Event catering"
            body="From thirty guests upward. Choose your courses, we bring the chafing dishes and the staff."
            cta="See catering bundles"
          />
          <PathCard
            href="/reservations"
            icon={CalendarDays}
            title="Table booking"
            body="Ninety-minute sittings across the main hall and the terrace. Confirmed instantly."
            cta="Reserve a table"
          />
        </div>
      </section>

      {/* Bestsellers */}
      <section className="container py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold/80">
              What everyone orders
            </p>
            <h2 className="heading-serif mt-2 text-3xl font-semibold sm:text-4xl">
              This week&rsquo;s bestsellers
            </h2>
          </div>
          <Button asChild variant="ghost" className="hidden shrink-0 sm:flex">
            <Link href="/menu">
              Full menu
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((dish, i) => (
            <Link
              key={dish.id}
              href={`/menu#section-${dish.categorySlug}`}
              className="surface group overflow-hidden transition-all hover:border-gold/25 hover:shadow-lift"
            >
              <DishImage
                src={dish.imageUrl}
                name={dish.name}
                priority={i < 2}
                sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw"
                className="aspect-[5/4] w-full"
              />
              <div className="p-4">
                <h3 className="flex items-center gap-1.5 text-[15px] font-medium">
                  <DietaryMark type={dish.dietaryType} size={12} />
                  <span className="truncate">{dish.name}</span>
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {dish.shortDescription}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gold">
                    {formatMoney(dish.basePriceCents)}
                  </span>
                  <SpiceBadge level={dish.spiceLevel} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <Button asChild variant="outline" className="mt-6 w-full sm:hidden">
          <Link href="/menu">
            See the full menu
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Kitchen note */}
      <section className="container pb-8">
        <div className="surface grid gap-8 p-8 lg:grid-cols-2 lg:p-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold/80">
              From the kitchen
            </p>
            <h2 className="heading-serif mt-3 text-3xl font-semibold">
              Four things we refuse to rush
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              None of this makes the food cheaper or faster. It is the whole
              reason people cross town for it.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/contact">Visit us in Little India</Link>
            </Button>
          </div>

          <ul className="space-y-5">
            {[
              {
                title: "The batter",
                body: "Ground on a stone wet grinder and left to ferment overnight. Never a mix, never same-day.",
              },
              {
                title: "The dum",
                body: "Raw marinated meat layered with half-cooked basmati and sealed under dough. Forty minutes, opened at the table.",
              },
              {
                title: "The masala",
                body: "Chettinad spices are dry-roasted and ground to order, not scooped from a tub.",
              },
              {
                title: "The kaapi",
                body: "Decoction brewed overnight in a steel filter and pulled by hand until it froths.",
              },
            ].map((item) => (
              <li key={item.title} className="border-l-2 border-gold/30 pl-4">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Gate Points */}
      <section className="container pb-8">
        <div className="surface flex flex-col items-start justify-between gap-6 border-gold/20 bg-gold/[0.04] p-8 sm:flex-row sm:items-center">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <Sparkles className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h2 className="heading-serif text-xl font-semibold">Gate Points</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Ten points for every dollar you spend on food. A thousand points
                is ten dollars off — no card, no app, just your mobile number.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/menu">Start earning</Link>
          </Button>
        </div>
      </section>

      {/* Hours */}
      <section className="container pb-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {OUTLET.hours.map((slot) => (
            <div key={slot.days} className="surface p-5">
              <p className="text-xs uppercase tracking-wider text-gold/80">
                {slot.days}
              </p>
              <p className="mt-1.5 text-lg font-medium">{slot.time}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Clock;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 shrink-0 text-gold/70" />
      <div>
        <dt className="sr-only">{label}</dt>
        <dd className="heading-serif text-lg font-semibold">{value}</dd>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function PathCard({
  href,
  icon: Icon,
  title,
  body,
  cta,
}: {
  href: string;
  icon: typeof Utensils;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="surface group flex flex-col p-6 transition-all hover:border-gold/25 hover:shadow-lift"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/25 bg-gold/[0.08]">
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <h3 className="heading-serif mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold">
        {cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
