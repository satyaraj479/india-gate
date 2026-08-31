import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Dish imagery, with a deterministic fallback.
 *
 * Food photography is commissioned per outlet and arrives later than the
 * build. Rather than shipping a grey box or hotlinking stock photos that
 * misrepresent the kitchen, an unphotographed dish gets a generated monogram
 * plate: a stable gradient derived from the dish name, so the same dish always
 * looks the same and the menu still reads as designed rather than as broken.
 *
 * When `imageUrl` is present it goes through `next/image` for AVIF/WebP
 * negotiation and correct `sizes` — the menu is image-heavy and this is where
 * mobile LCP is won or lost.
 */

/** FNV-1a. Small, stable, and no dependency. */
const hash = (value: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

export function DishImage({
  src,
  name,
  className,
  sizes = "(min-width: 1024px) 220px, (min-width: 640px) 30vw, 40vw",
  priority = false,
}: {
  src: string | null;
  name: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden bg-navy-700", className)}>
        <Image
          src={src}
          alt={name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
    );
  }

  // Two hue stops 40° apart, seeded from the name, keep the plates varied
  // without ever straying far from the warm palette.
  const seed = hash(name);
  const hue = seed % 360;
  const hueB = (hue + 40) % 360;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-navy-700",
        className,
      )}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: `radial-gradient(120% 120% at 25% 15%, hsl(${hue} 42% 32%), transparent 62%), radial-gradient(110% 110% at 85% 90%, hsl(${hueB} 38% 22%), transparent 58%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, hsl(46 65% 52% / 0.5) 0 1px, transparent 1px 9px)",
        }}
      />
      <span className="heading-serif relative text-2xl font-semibold text-gold/70">
        {initials(name)}
      </span>
    </div>
  );
}
