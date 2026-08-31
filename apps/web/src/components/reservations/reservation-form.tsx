"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Minus,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { OUTLET } from "@/lib/config";

/**
 * Table booking.
 *
 * Slot capacity is modelled in *covers*, not tables, which is how a restaurant
 * floor actually works: a party of two and a party of six both consume from
 * the same 7:30 PM pool. Full slots are shown greyed rather than hidden — a
 * gap in the grid reads as a bug, whereas "7:30 PM · full" reads as a busy
 * Friday and pushes the guest to 8:00 instead of away from the page.
 *
 * The availability below is derived deterministically from the date and time
 * so the grid is stable across renders. In production this is
 * `GET /reservations/availability`, and the two-phase hold in the API contract
 * is what prevents two guests taking the last four covers at once — a race a
 * client-side check can never close.
 */

const SERVICE_WINDOWS = [
  { name: "Lunch", startMinutes: 11 * 60 + 30, endMinutes: 14 * 60 + 30 },
  { name: "Dinner", startMinutes: 17 * 60 + 30, endMinutes: 21 * 60 + 30 },
];

const SLOT_INTERVAL_MINUTES = 30;
const CAPACITY_PER_SLOT = 24;
const MAX_ONLINE_PARTY = 8;
const HORIZON_DAYS = 21;

/** FNV-1a, so the same slot always shows the same remaining covers. */
const hash = (value: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
};

const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const minutesToLabel = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
};

interface Slot {
  startMinutes: number;
  label: string;
  remainingPax: number;
}

const buildSlots = (isoDate: string): Slot[] => {
  const slots: Slot[] = [];
  for (const window of SERVICE_WINDOWS) {
    // Stop 90 minutes before close: a sitting has to finish before service ends.
    for (
      let m = window.startMinutes;
      m <= window.endMinutes - 90;
      m += SLOT_INTERVAL_MINUTES
    ) {
      const seed = hash(`${isoDate}:${m}`);
      // Weekends and prime time (7–8:30 PM) run tighter than a Tuesday lunch.
      const isPrime = m >= 19 * 60 && m <= 20 * 60 + 30;
      const booked = seed % (isPrime ? CAPACITY_PER_SLOT + 6 : CAPACITY_PER_SLOT);
      slots.push({
        startMinutes: m,
        label: minutesToLabel(m),
        remainingPax: Math.max(0, CAPACITY_PER_SLOT - booked),
      });
    }
  }
  return slots;
};

export function ReservationForm() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: HORIZON_DAYS }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        return date;
      }),
    [today],
  );

  const [selectedDate, setSelectedDate] = useState<Date>(days[0]!);
  const [partySize, setPartySize] = useState(2);
  const [slotMinutes, setSlotMinutes] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [occasion, setOccasion] = useState("");
  const [requests, setRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ code: string; when: string } | null>(
    null,
  );

  const isoDate = toISODate(selectedDate);
  const slots = useMemo(() => buildSlots(isoDate), [isoDate]);

  const selectedSlot = slots.find((s) => s.startMinutes === slotMinutes) ?? null;
  const oversized = partySize > MAX_ONLINE_PARTY;

  const canSubmit =
    Boolean(selectedSlot) &&
    !oversized &&
    name.trim().length > 1 &&
    /^(\+65)?[689]\d{7}$/.test(phone.replace(/[\s-]/g, ""));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !selectedSlot) return;

    setSubmitting(true);
    // Stands in for hold-then-confirm: `POST /reservations/holds` locks the
    // covers, then `POST /reservations` promotes the hold once these details
    // are filled in.
    await new Promise((r) => setTimeout(r, 700));

    const code = `IG-R-${String(hash(`${isoDate}${selectedSlot.startMinutes}${phone}`) % 90000 + 10000)}`;
    const when = `${new Intl.DateTimeFormat("en-SG", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(selectedDate)} at ${selectedSlot.label}`;

    setConfirmed({ code, when });
    setSubmitting(false);
    toast.success("Table confirmed", { description: when });
  };

  if (confirmed) {
    return (
      <div className="surface mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-veg/30 bg-veg/10">
          <CheckCircle2 className="h-7 w-7 text-veg" />
        </div>
        <h2 className="heading-serif mt-5 text-2xl font-semibold">
          Your table is booked
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {confirmed.when} · {partySize}{" "}
          {partySize === 1 ? "guest" : "guests"}
        </p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.08] px-4 py-2">
          <span className="font-mono text-sm font-semibold tracking-wider text-gold">
            {confirmed.code}
          </span>
        </p>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          We hold tables for 15 minutes past the booking time. If you are
          running late, call {OUTLET.phoneDisplay} and we will do our best.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setConfirmed(null);
            setSlotMinutes(null);
          }}
        >
          Book another table
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Date */}
        <section className="surface p-5">
          <h2 className="heading-serif mb-4 flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-5 w-5 text-gold" />
            Pick a date
          </h2>
          <div
            role="radiogroup"
            aria-label="Reservation date"
            className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {days.map((day) => {
              const iso = toISODate(day);
              const selected = iso === isoDate;
              const isToday = iso === toISODate(today);
              return (
                <button
                  key={iso}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setSelectedDate(day);
                    setSlotMinutes(null);
                  }}
                  className={cn(
                    "flex w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-lg border py-2.5 transition-all",
                    selected
                      ? "border-gold/60 bg-gold/12 text-gold"
                      : "border-white/10 bg-navy-900/40 text-muted-foreground hover:border-white/25 hover:text-foreground",
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wider">
                    {isToday
                      ? "Today"
                      : new Intl.DateTimeFormat("en-SG", { weekday: "short" }).format(day)}
                  </span>
                  <span className="text-lg font-semibold leading-none">
                    {day.getDate()}
                  </span>
                  <span className="text-[10px] uppercase">
                    {new Intl.DateTimeFormat("en-SG", { month: "short" }).format(day)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Party size */}
        <section className="surface p-5">
          <h2 className="heading-serif mb-4 flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-gold" />
            How many guests?
          </h2>

          <div className="flex items-center gap-4">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-navy-900/70 p-1">
              <button
                type="button"
                onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                disabled={partySize <= 1}
                aria-label="Fewer guests"
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span
                className="min-w-[2.5rem] text-center text-lg font-semibold tabular-nums"
                aria-live="polite"
              >
                <span className="sr-only">Party size: </span>
                {partySize}
              </span>
              <button
                type="button"
                onClick={() => setPartySize((n) => Math.min(20, n + 1))}
                disabled={partySize >= 20}
                aria-label="More guests"
                className="flex h-9 w-9 items-center justify-center rounded-full text-gold transition-colors hover:bg-gold/15 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {partySize === 1 ? "1 guest" : `${partySize} guests`} · 90-minute
              sitting
            </p>
          </div>

          {oversized && (
            <div className="mt-4 rounded-md border border-gold/25 bg-gold/[0.07] px-3 py-2.5 text-xs text-foreground/90">
              Parties over {MAX_ONLINE_PARTY} are arranged by phone so we can
              join tables properly. Call{" "}
              <a
                href={`tel:${OUTLET.phone.replace(/\s/g, "")}`}
                className="font-medium text-gold underline underline-offset-4"
              >
                {OUTLET.phoneDisplay}
              </a>
              , or ask about our catering bundles.
            </div>
          )}
        </section>

        {/* Time */}
        <section className="surface p-5">
          <h2 className="heading-serif mb-4 flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-gold" />
            Choose a time
          </h2>

          {SERVICE_WINDOWS.map((window) => {
            const windowSlots = slots.filter(
              (s) => s.startMinutes >= window.startMinutes && s.startMinutes <= window.endMinutes,
            );
            return (
              <div key={window.name} className="mb-5 last:mb-0">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {window.name}
                </p>
                <div
                  role="radiogroup"
                  aria-label={`${window.name} times`}
                  className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                >
                  {windowSlots.map((slot) => {
                    const full = slot.remainingPax < partySize;
                    const selected = slot.startMinutes === slotMinutes;
                    const scarce = !full && slot.remainingPax <= 6;

                    return (
                      <button
                        key={slot.startMinutes}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={full || oversized}
                        onClick={() => setSlotMinutes(slot.startMinutes)}
                        className={cn(
                          "rounded-lg border px-2 py-2.5 text-sm font-medium transition-all",
                          full || oversized
                            ? "cursor-not-allowed border-white/[0.06] bg-navy-900/30 text-muted-foreground/40 line-through"
                            : selected
                              ? "border-gold/60 bg-gold/12 text-gold"
                              : "border-white/10 bg-navy-900/40 hover:border-white/25",
                        )}
                      >
                        {slot.label}
                        {scarce && !selected && (
                          <span className="mt-0.5 block text-[10px] font-normal text-gold/70">
                            {slot.remainingPax} left
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* Guest details */}
        <section className="surface p-5">
          <h2 className="heading-serif mb-4 text-lg font-semibold">
            Who is the table for?
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="block">
                <span className="mb-1.5 block">Name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label className="block">
                <span className="mb-1.5 block">Mobile</span>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label className="block">
                <span className="mb-1.5 block">
                  Email{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label className="block">
                <span className="mb-1.5 block">
                  Occasion{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <Input
                  placeholder="Birthday, anniversary"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                />
              </Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="block">
                <span className="mb-1.5 block">
                  Anything we should know?{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <Textarea
                  placeholder="High chair for a toddler, wheelchair access, quiet corner"
                  maxLength={500}
                  value={requests}
                  onChange={(e) => setRequests(e.target.value)}
                />
              </Label>
            </div>
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="surface p-5">
          <h2 className="heading-serif text-lg font-semibold">Your booking</h2>

          <dl className="mt-4 space-y-3 text-sm">
            <SummaryRow
              label="Date"
              value={new Intl.DateTimeFormat("en-SG", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(selectedDate)}
            />
            <SummaryRow
              label="Time"
              value={selectedSlot ? selectedSlot.label : "Not chosen yet"}
              muted={!selectedSlot}
            />
            <SummaryRow
              label="Guests"
              value={`${partySize} ${partySize === 1 ? "guest" : "guests"}`}
            />
            <SummaryRow label="Sitting" value="90 minutes" />
          </dl>

          <Separator className="my-4" />

          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <Badge variant="muted" className="shrink-0">
                Free
              </Badge>
              No deposit for parties of {MAX_ONLINE_PARTY} or fewer.
            </p>
            <p>
              Tables are held for 15 minutes. Cancel any time up to two hours
              before.
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit || submitting}
            className="mt-5 w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Holding your table…
              </>
            ) : (
              "Confirm booking"
            )}
          </Button>

          {!selectedSlot && !oversized && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Choose a time to continue.
            </p>
          )}
        </div>
      </aside>
    </form>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right", muted ? "text-muted-foreground/60" : "font-medium")}>
        {value}
      </dd>
    </div>
  );
}
