import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98] text-[clamp(0.8125rem,0.75rem+0.2vw,0.875rem)]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/85 hover:shadow-md hover:shadow-primary/25",
        destructive: "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 hover:bg-destructive/85 hover:shadow-md hover:shadow-destructive/25",
        success: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] shadow-sm shadow-emerald-500/20 hover:bg-[hsl(var(--success))]/85 hover:shadow-md hover:shadow-emerald-500/25",
        warning: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] shadow-sm shadow-amber-500/20 hover:bg-[hsl(var(--warning))]/85 hover:shadow-md hover:shadow-amber-500/25",
        outline: "border border-[hsl(var(--border))] bg-transparent text-foreground hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--border))]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-muted-foreground hover:bg-[hsl(var(--muted))] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[var(--touch-min)] h-11 px-4 py-2",
        sm: "h-10 min-h-[2.5rem] rounded-md px-3.5 text-xs",
        lg: "h-12 min-h-[3rem] rounded-lg px-6",
        icon: "h-11 w-11 min-h-[var(--touch-min)] min-w-[var(--touch-min)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
