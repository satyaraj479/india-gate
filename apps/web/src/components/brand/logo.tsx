import { cn } from "@/lib/utils";

/**
 * The mark: a stylised gateway arch. Inline SVG rather than an image file so
 * it inherits `currentColor`, stays crisp at every density, and costs no
 * request on the critical path.
 */
export function GateMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <defs>
        <linearGradient id="ig-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(46 62% 44%)" />
          <stop offset="45%" stopColor="hsl(46 71% 64%)" />
          <stop offset="100%" stopColor="hsl(46 62% 44%)" />
        </linearGradient>
      </defs>
      {/* Outer arch */}
      <path
        d="M4 29V15.5C4 8.6 9.4 3 16 3s12 5.6 12 12.5V29"
        stroke="url(#ig-gold)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Inner arch */}
      <path
        d="M10 29V16.2c0-3.6 2.7-6.5 6-6.5s6 2.9 6 6.5V29"
        stroke="url(#ig-gold)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* Finial */}
      <circle cx="16" cy="6.2" r="1.6" fill="url(#ig-gold)" />
      <path d="M3 29h26" stroke="url(#ig-gold)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({
  className,
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <GateMark />
      <span className="flex flex-col leading-none">
        <span className="heading-serif text-[19px] font-semibold tracking-wide text-foreground">
          India&nbsp;Gate
        </span>
        {showTagline && (
          <span className="mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.22em] text-gold/70">
            South Indian Kitchen
          </span>
        )}
      </span>
    </span>
  );
}
