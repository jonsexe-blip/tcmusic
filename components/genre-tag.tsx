"use client"

import type { Genre, GenreMood } from "@/lib/types"
import { genreDisplayNames, moodConfig } from "@/lib/filters"
import { cn } from "@/lib/utils"

interface GenreTagProps {
  genre: Genre
  size?: "sm" | "md"
  className?: string
}

export function GenreTag({ genre, size = "md", className }: GenreTagProps) {
  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium uppercase tracking-wide",
        "border border-muted-foreground/30 text-muted-foreground rounded-sm",
        sizeClasses[size],
        className
      )}
    >
      {genreDisplayNames[genre]}
    </span>
  )
}

interface MoodTagProps {
  mood: GenreMood
  active?: boolean
  onClick?: () => void
  className?: string
}

export function MoodTag({ mood, active, onClick, className }: MoodTagProps) {
  const config = moodConfig[mood]

  const moodColors: Record<GenreMood, string> = {
    heavy: "bg-red-500/20 border-red-500 text-red-400",
    chill: "bg-blue-500/20 border-blue-500 text-blue-400",
    dancey: "bg-pink-500/20 border-pink-500 text-pink-400",
    experimental: "bg-purple-500/20 border-purple-500 text-purple-400",
    all: "bg-muted border-muted-foreground/50 text-muted-foreground",
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide",
        "px-3 py-2 rounded-sm border transition-all",
        active
          ? moodColors[mood]
          : "border-border text-muted-foreground hover:border-muted-foreground",
        onClick && "cursor-pointer",
        className
      )}
    >
      {config.name}
    </button>
  )
}
