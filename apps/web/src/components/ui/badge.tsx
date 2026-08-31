import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors",
  {
    variants: {
      variant: {
        default: "border-gold/30 bg-gold/10 text-gold-400",
        outline: "border-white/15 bg-transparent text-muted-foreground",
        solid: "border-transparent bg-gold text-primary-foreground",
        veg: "border-veg/40 bg-veg/10 text-veg",
        nonveg: "border-nonveg/40 bg-nonveg/10 text-nonveg",
        muted: "border-white/10 bg-white/[0.04] text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
