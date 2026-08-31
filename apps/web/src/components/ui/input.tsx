import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md border border-white/10 bg-input px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground/70",
        "transition-colors focus-visible:border-gold/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-destructive/70",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
