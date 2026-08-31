"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary.
 *
 * Shows the digest rather than the raw message: Next.js strips server error
 * messages in production precisely so they cannot leak internals to the
 * browser, and the digest is what ties a guest's screenshot to the server log.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="heading-serif text-3xl font-semibold sm:text-4xl">
        Something went wrong in the kitchen
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        This one is on us, not on you. Nothing has been charged. Try again, or
        call the restaurant and we will take the order over the phone.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted-foreground/60">
          Reference: {error.digest}
        </p>
      )}
      <Button onClick={reset} className="mt-7">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
