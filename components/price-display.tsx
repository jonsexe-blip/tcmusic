import type { EventPrice } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PriceDisplayProps {
  price: EventPrice | "free" | "tbd"
  size?: "sm" | "md" | "lg"
  className?: string
}

export function PriceDisplay({
  price,
  size = "md",
  className,
}: PriceDisplayProps) {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  if (price === "free") {
    return (
      <span
        className={cn(
          "font-bold uppercase tracking-wide text-emerald-400",
          sizeClasses[size],
          className
        )}
      >
        Free
      </span>
    )
  }

  if (price === "tbd") {
    return (
      <span
        className={cn(
          "font-medium text-muted-foreground",
          sizeClasses[size],
          className
        )}
      >
        TBD
      </span>
    )
  }

  if (price.min === price.max) {
    return (
      <span className={cn("font-semibold", sizeClasses[size], className)}>
        ${price.min}
      </span>
    )
  }

  return (
    <span className={cn("font-semibold", sizeClasses[size], className)}>
      ${price.min}-${price.max}
    </span>
  )
}
