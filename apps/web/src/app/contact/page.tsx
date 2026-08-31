import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock, Mail, MapPin, Phone, Train } from "lucide-react";

import { ContactForm } from "@/components/contact/contact-form";
import { Skeleton } from "@/components/ui/skeleton";
import { OUTLET } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Find India Gate at 42 Serangoon Road, Little India, Singapore. Opening hours, phone, directions and catering enquiries.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-white/[0.06] bg-navy-950/30">
        <div className="container py-12 sm:py-16">
          <h1 className="heading-serif text-4xl font-semibold sm:text-5xl">
            Come <span className="text-gradient-gold">see us</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Two minutes from Little India MRT, on the Serangoon Road side. The
            kitchen is open through the afternoon — there is no break between
            lunch and dinner.
          </p>
        </div>
      </section>

      <div className="container grid gap-8 py-12 lg:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <div className="surface p-6">
            <h2 className="heading-serif mb-5 text-xl font-semibold">
              The restaurant
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <InfoBlock icon={MapPin} title="Address">
                <address className="not-italic">
                  {OUTLET.addressLine1}
                  <br />
                  {OUTLET.addressLine2}
                  <br />
                  Singapore {OUTLET.postalCode}
                </address>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(
                    `${OUTLET.addressLine1}, Singapore ${OUTLET.postalCode}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-block font-medium text-gold underline underline-offset-4"
                >
                  Open in Maps
                </a>
              </InfoBlock>

              <InfoBlock icon={Train} title="Getting here">
                Little India MRT (NE7 / DT12), Exit E.
                <br />
                Buses 23, 64, 65, 66, 139.
                <br />
                Paid parking at Tekka Centre.
              </InfoBlock>

              <InfoBlock icon={Phone} title="Phone">
                <a
                  href={`tel:${OUTLET.phone.replace(/\s/g, "")}`}
                  className="transition-colors hover:text-gold"
                >
                  {OUTLET.phoneDisplay}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  Best for same-day bookings and large parties.
                </p>
              </InfoBlock>

              <InfoBlock icon={Mail} title="Email">
                <a
                  href={`mailto:${OUTLET.email}`}
                  className="break-all transition-colors hover:text-gold"
                >
                  {OUTLET.email}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  We reply to catering enquiries within one working day.
                </p>
              </InfoBlock>
            </div>
          </div>

          <div className="surface p-6">
            <h2 className="heading-serif mb-4 flex items-center gap-2 text-xl font-semibold">
              <Clock className="h-5 w-5 text-gold" />
              Opening hours
            </h2>
            <dl className="divide-y divide-white/[0.07]">
              {OUTLET.hours.map((slot) => (
                <div
                  key={slot.days}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <dt className="text-muted-foreground">{slot.days}</dt>
                  <dd className="font-medium tabular-nums">{slot.time}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Closed on Deepavali day and the morning of Pongal. Catering runs
              through both — book early.
            </p>
          </div>
        </div>

        {/*
          The form reads `?enquiry=` and `?bundle=` from the query string via
          `useSearchParams`, which opts its subtree out of static rendering.
          The boundary keeps that opt-out local: the address and hours above
          still prerender as static HTML, which is what this page is indexed
          for.
        */}
        <Suspense
          fallback={
            <div className="surface h-fit space-y-4 p-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2 pt-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-7 w-20 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          }
        >
          <ContactForm />
        </Suspense>
      </div>
    </>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/[0.07]">
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <div className="min-w-0 text-sm">
        <h3 className="mb-1 font-medium">{title}</h3>
        <div className="leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
