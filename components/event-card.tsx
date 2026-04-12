"use client"

import Link from "next/link"
import type { Event } from "@/lib/types"
import { NeighborhoodBadge } from "./neighborhood-badge"
import { PriceDisplay } from "./price-display"
import { AgeBadge } from "./age-badge"
import { cn } from "@/lib/utils"
import { getNeighborhoodConfig } from "@/lib/neighborhoods"

interface EventCardProps {
  event: Event
  variant?: "default" | "compact" | "featured"
  className?: string
}

export function EventCard({
  event,
  variant = "default",
  className,
}: EventCardProps) {
  const neighborhoodConfig = getNeighborhoodConfig(event.venue.neighborhood)

  // Format date for display
  const eventDate = new Date(event.date + "T00:00:00")
  const dayOfWeek = eventDate.toLocaleDateString("en-US", { weekday: "short" })
  const month = eventDate.toLocaleDateString("en-US", { month: "short" })
  const day = eventDate.getDate()

  if (variant === "compact") {
    return (
      <Link
        href={`/event/${event.id}`}
        className={cn(
          "group flex items-center gap-4 p-3 rounded-lg",
          "bg-card hover:bg-secondary transition-colors",
          "border border-border hover:border-muted-foreground/50",
          className
        )}
      >
        {/* Date block */}
        <div className="flex flex-col items-center justify-center w-12 shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {dayOfWeek}
          </span>
          <span className="text-2xl font-bold leading-none">{day}</span>
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {month}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate group-hover:text-accent transition-colors">
            {event.artist}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {event.venue.name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {event.time !== "TBA" && (
              <span className="text-xs text-muted-foreground">{event.time}</span>
            )}
            {event.price !== "tbd" && (
              <PriceDisplay price={event.price} size="sm" />
            )}
          </div>
        </div>

        {/* Neighborhood indicator */}
        <div
          className="w-1 h-12 rounded-full shrink-0"
          style={{ backgroundColor: neighborhoodConfig.color }}
        />
      </Link>
    )
  }

  if (variant === "featured") {
    return (
      <Link
        href={`/event/${event.id}`}
        className={cn(
          "group relative flex flex-col justify-end overflow-hidden rounded-lg",
          "aspect-[16/9] min-h-[200px] max-h-[280px]",
          "bg-gradient-to-t from-background via-background/80 to-transparent",
          className
        )}
        style={{
          backgroundImage: `linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.6) 50%, rgba(10,10,10,0.2) 100%), url(${event.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Neighborhood color accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: neighborhoodConfig.color }}
        />

        {/* Content */}
        <div className="relative p-4">
          <div className="flex items-center gap-2 mb-2">
            <NeighborhoodBadge
              neighborhood={event.venue.neighborhood}
              size="sm"
            />
            <AgeBadge age={event.ageRestriction} size="sm" />
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight leading-none mb-1 group-hover:text-accent transition-colors">
            {event.artist}
          </h2>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{event.venue.name}</span>
              <span>·</span>
              <span>{dayOfWeek}, {month} {day}</span>
              <span>·</span>
              <span>{event.time}</span>
            </div>
            <PriceDisplay price={event.price} size="md" />
          </div>
        </div>
      </Link>
    )
  }

  // Default poster-style card
  const hasImage = event.imageUrl && event.imageUrl !== "/placeholder-event.jpg"
  const color = neighborhoodConfig.color

  return (
    <Link
      href={`/event/${event.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg",
        "bg-card border border-border hover:border-muted-foreground/50",
        "transition-all hover:scale-[1.02] hover:shadow-xl",
        className
      )}
    >
      {/* Image area with gradient overlay */}
      <div
        className="relative aspect-[3/2]"
        style={hasImage ? {
          backgroundImage: `linear-gradient(to top, rgba(10,10,10,1) 0%, rgba(10,10,10,0.3) 100%), url(${event.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : {
          backgroundImage: `linear-gradient(135deg, ${color}40 0%, ${color}10 50%, rgba(10,10,10,0.9) 100%), linear-gradient(to top, rgba(10,10,10,1) 0%, rgba(10,10,10,0.4) 100%)`,
          backgroundColor: "#0a0a0a",
        }}
      >
        {/* Neighborhood color accent */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: neighborhoodConfig.color }}
        />

        {/* Date badge overlay */}
        <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm rounded px-1.5 py-0.5 text-center">
          <span className="block text-[10px] font-medium text-muted-foreground uppercase">
            {dayOfWeek}
          </span>
          <span className="block text-lg font-bold leading-none">{day}</span>
          <span className="block text-[10px] font-medium text-muted-foreground uppercase">
            {month}
          </span>
        </div>

        {/* Artist name - poster style */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-lg font-extrabold uppercase tracking-tight leading-tight group-hover:text-accent transition-colors">
            {event.artist}
          </h3>
        </div>
      </div>

      {/* Info area */}
      <div className="px-3 py-2 flex-1 flex flex-col">
        <p className="text-xs font-medium text-muted-foreground mb-1.5 truncate">
          {event.venue.name}
        </p>

        <div className="flex items-center gap-1.5 mt-auto flex-wrap">
          <span className="text-xs text-muted-foreground">{dayOfWeek}, {month} {day}</span>
          {event.time !== "TBA" && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{event.time}</span>
            </>
          )}
          {event.price !== "tbd" && (
            <>
              <span className="text-muted-foreground">·</span>
              <PriceDisplay price={event.price} size="sm" />
            </>
          )}
          <span className="text-muted-foreground">·</span>
          <AgeBadge age={event.ageRestriction} size="sm" />
        </div>

        <NeighborhoodBadge
          neighborhood={event.venue.neighborhood}
          size="sm"
          className="mt-2 self-start"
        />
      </div>
    </Link>
  )
}
