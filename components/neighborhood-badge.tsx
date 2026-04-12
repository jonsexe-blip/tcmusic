"use client"

import { getNeighborhoodConfig } from "@/lib/neighborhoods"
import type { Neighborhood } from "@/lib/types"
import { cn } from "@/lib/utils"

interface NeighborhoodBadgeProps {
  neighborhood: Neighborhood
  size?: "sm" | "md" | "lg"
  className?: string
}

export function NeighborhoodBadge({
  neighborhood,
  size = "md",
  className,
}: NeighborhoodBadgeProps) {
  const config = getNeighborhoodConfig(neighborhood)

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-3 py-1.5",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold uppercase tracking-wider rounded-sm",
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: config.color,
        color: config.textColor,
      }}
    >
      {config.name}
    </span>
  )
}
