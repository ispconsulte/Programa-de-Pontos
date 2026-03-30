import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[var(--touch-min)] h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-3.5 py-2 text-sm text-foreground ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:bg-[hsl(var(--surface-2))] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
