import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";
import { SPICE_LEVEL_HEAT, SPICE_LEVEL_LABEL, type SpiceLevel } from "@/types/catalog";

const TONE: Record<SpiceLevel, string> = {
  NONE: "text-muted-foreground",
  MILD: "text-veg",
  MEDIUM: "text-gold-400",
  SPICY: "text-orange-400",
  EXTRA_SPICY: "text-nonveg",
};

/**
 * Heat shown as filled-versus-outlined flames out of four, not as a word.
 * "Medium" means different things to different guests; three flames out of
 * four is comparative and reads at a glance across a scrolling menu.
 */
export function SpiceBadge({
  level,
  className,
  showLabel = false,
}: {
  level: SpiceLevel;
  className?: string;
  showLabel?: boolean;
}) {
  const heat = SPICE_LEVEL_HEAT[level];
  if (heat === 0 && !showLabel) return null;

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      title={SPICE_LEVEL_LABEL[level]}
    >
      <span className="flex items-center gap-px" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <Flame
            key={n}
            className={cn(
              "h-3 w-3 transition-colors",
              n <= heat ? cn(TONE[level], "fill-current") : "text-white/15",
            )}
          />
        ))}
      </span>
      <span className={showLabel ? cn("text-xs font-medium", TONE[level]) : "sr-only"}>
        {SPICE_LEVEL_LABEL[level]}
      </span>
    </span>
  );
}
