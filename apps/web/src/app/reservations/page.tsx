import type { Metadata } from "next";

import { ReservationForm } from "@/components/reservations/reservation-form";
import { OUTLET } from "@/lib/config";

export const metadata: Metadata = {
  title: "Table Booking",
  description:
    "Reserve a table at India Gate in Little India, Singapore. Ninety-minute sittings across lunch and dinner, confirmed instantly.",
  alternates: { canonical: "/reservations" },
};

export default function ReservationsPage() {
  return (
    <>
      <section className="border-b border-white/[0.06] bg-navy-950/30">
        <div className="container py-12 sm:py-16">
          <h1 className="heading-serif text-4xl font-semibold sm:text-5xl">
            Book a <span className="text-gradient-gold">table</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {OUTLET.addressLine1}, {OUTLET.addressLine2}. Lunch from 11:30, dinner
            from 5:30. The terrace seats twenty and takes walk-ins when the main
            hall is full.
          </p>
        </div>
      </section>

      <div className="container py-10">
        <ReservationForm />
      </div>
    </>
  );
}
