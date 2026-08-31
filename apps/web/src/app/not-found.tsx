import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-navy-800">
        <UtensilsCrossed className="h-7 w-7 text-gold/70" />
      </div>
      <h1 className="heading-serif mt-6 text-3xl font-semibold sm:text-4xl">
        Not on the menu
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        This page has been taken off, or the link was mistyped. The kitchen is
        still open.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/menu">Browse the menu</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">Back to the start</Link>
        </Button>
      </div>
    </div>
  );
}
