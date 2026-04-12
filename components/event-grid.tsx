"use client"

import type { Event } from "@/lib/types"
import { EventCard } from "./event-card"
import { cn } from "@/lib/utils"

interface EventGridProps {
  events: Event[]
  variant?: "default" | "compact" | "editorial"
  columns?: 2 | 3 | 4
  className?: string
}

export function EventGrid({
  events,
  variant = "default",
  columns = 4,
  className,
}: EventGridProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-xl font-bold text-muted-foreground">No shows found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Try adjusting your filters or check back later
        </p>
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {events.map((event) => (
          <EventCard key={event.id} event={event} variant="compact" />
        ))}
      </div>
    )
  }

  if (variant === "editorial") {
    // Editorial layout with featured first event and varied sizes
    const [featured, ...rest] = events

    return (
      <div className={cn("space-y-6", className)}>
        {/* Featured event */}
        {featured && (
          <EventCard event={featured} variant="featured" className="w-full" />
        )}

        {/* Grid of remaining events */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Default grid
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        columns === 2
          ? "sm:grid-cols-2"
          : columns === 3
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
