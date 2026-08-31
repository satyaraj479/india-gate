"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EnquiryType = "general" | "catering" | "feedback" | "careers";

const ENQUIRY_TYPES: Array<{ value: EnquiryType; label: string }> = [
  { value: "general", label: "General" },
  { value: "catering", label: "Catering" },
  { value: "feedback", label: "Feedback" },
  { value: "careers", label: "Careers" },
];

/**
 * Enquiry form.
 *
 * Pre-selects the enquiry type from the query string, so the "Enquire about
 * Wedding Deluxe" buttons on the catering page land here with the right tab
 * already chosen and the bundle named in the message. Making someone re-state
 * what they just clicked is the fastest way to lose a catering lead.
 */
export function ContactForm() {
  const params = useSearchParams();
  const initialType = (params.get("enquiry") as EnquiryType | null) ?? "general";
  const bundle = params.get("bundle");

  const [type, setType] = useState<EnquiryType>(
    ENQUIRY_TYPES.some((t) => t.value === initialType) ? initialType : "general",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    bundle ? `I would like to enquire about the ${bundle} catering bundle.\n\n` : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const valid =
    name.trim().length > 1 &&
    /^\S+@\S+\.\S+$/.test(email) &&
    message.trim().length > 9;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    setSent(true);
    toast.success("Message sent", {
      description: "We reply within one working day.",
    });
  };

  if (sent) {
    return (
      <div className="surface flex flex-col items-center justify-center p-8 text-center lg:sticky lg:top-32 lg:self-start">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-veg/30 bg-veg/10">
          <CheckCircle2 className="h-7 w-7 text-veg" />
        </div>
        <h2 className="heading-serif mt-5 text-xl font-semibold">
          Thank you, {name.split(" ")[0]}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your message is with us. We reply within one working day — sooner for
          catering enquiries with a date attached.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setSent(false);
            setMessage("");
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="surface h-fit p-6 lg:sticky lg:top-32 lg:self-start"
    >
      <h2 className="heading-serif text-xl font-semibold">Send us a message</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        For same-day bookings, please call instead — we do not watch this inbox
        during service.
      </p>

      <div
        role="radiogroup"
        aria-label="Enquiry type"
        className="mt-5 flex flex-wrap gap-2"
      >
        {ENQUIRY_TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={type === option.value}
            onClick={() => setType(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              type === option.value
                ? "border-gold/60 bg-gold/12 text-gold"
                : "border-white/10 bg-navy-900/40 text-muted-foreground hover:border-white/25 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <Label className="block">
          <span className="mb-1.5 block">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </Label>

        <Label className="block">
          <span className="mb-1.5 block">Email</span>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Label>

        <Label className="block">
          <span className="mb-1.5 block">
            Phone{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Label>

        <Label className="block">
          <span className="mb-1.5 block">
            Message
            {type === "catering" && (
              <span className="ml-1 font-normal text-muted-foreground">
                — include your date and guest count
              </span>
            )}
          </span>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            className="min-h-[130px]"
            required
          />
        </Label>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!valid || submitting}
        className="mt-5 w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send message
          </>
        )}
      </Button>
    </form>
  );
}
