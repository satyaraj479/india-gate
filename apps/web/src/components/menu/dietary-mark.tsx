import { cn } from "@/lib/utils";
import type { DietaryType } from "@/types/catalog";

const CONFIG: Record<
  DietaryType,
  { colour: string; label: string; shape: "dot" | "triangle" }
> = {
  VEG: { colour: "text-veg", label: "Vegetarian", shape: "dot" },
  NON_VEG: { colour: "text-nonveg", label: "Non-vegetarian", shape: "triangle" },
  EGG: { colour: "text-gold", label: "Contains egg", shape: "dot" },
};

/**
 * The square-with-inner-mark used across South Asian menus: a green dot for
 * vegetarian, a brown-red triangle for non-vegetarian.
 *
 * Colour alone is not the signal — the inner shape differs too, so the marking
 * still reads for the ~8% of men with red-green colour vision deficiency.
 * Every instance carries a text label for screen readers; a coloured square
 * with no accessible name is meaningless to them.
 */
export function DietaryMark({
  type,
  className,
  size = 14,
}: {
  type: DietaryType;
  className?: string;
  size?: number;
}) {
  const { colour, label, shape } = CONFIG[type];

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-current",
        colour,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {shape === "dot" ? (
        <span
          className="rounded-full bg-current"
          style={{ width: size * 0.45, height: size * 0.45 }}
        />
      ) : (
        <svg
          viewBox="0 0 10 9"
          className="fill-current"
          style={{ width: size * 0.55, height: size * 0.5 }}
          aria-hidden="true"
        >
          <path d="M5 0.5 9.5 8.5H0.5z" />
        </svg>
      )}
    </span>
  );
}
