import type { AgeRestriction } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AgeBadgeProps {
  age: AgeRestriction
  size?: "sm" | "md"
  className?: string
}

export function AgeBadge({ age, size = "md", className }: AgeBadgeProps) {
  const sizeClasses = {
    sm: "text-[10px] px-1 py-0.5",
    md: "text-xs px-1.5 py-0.5",
  }

  const ageLabels: Record<AgeRestriction, string> = {
    "all-ages": "ALL AGES",
    "18+": "18+",
    "21+": "21+",
  }

  const ageColors: Record<AgeRestriction, string> = {
    "all-ages": "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
    "18+": "bg-amber-500/20 text-amber-400 border-amber-500/50",
    "21+": "bg-red-500/20 text-red-400 border-red-500/50",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-bold tracking-wide rounded-sm border",
        sizeClasses[size],
        ageColors[age],
        className
      )}
    >
      {ageLabels[age]}
    </span>
  )
}
