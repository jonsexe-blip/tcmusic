"use client"

import Link from "next/link"
import { X, Check, ExternalLink } from "lucide-react"
import type { Event } from "@/lib/types"
import { getNeighborhoodConfig } from "@/lib/neighborhoods"
import { NeighborhoodBadge } from "./neighborhood-badge"
import { GenreTag } from "./genre-tag"
import { PriceDisplay } from "./price-display"
import { AgeBadge } from "./age-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DiscoverCardProps {
  event: Event
  onSkip: () => void
  onSave: () => void
  className?: string
}

export function DiscoverCard({
  event,
  onSkip,
  onSave,
  className,
}: DiscoverCardProps) {
  const neighborhoodConfig = getNeighborhoodConfig(event.venue.neighborhood)

  // Format date
  const eventDate = new Date(event.date + "T00:00:00")
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl overflow-hidden bg-card border border-border",
        "shadow-2xl max-w-sm mx-auto",
        className
      )}
    >
      {/* Image/Hero area */}
      <div
        className="relative aspect-[3/4] bg-gradient-to-b from-secondary to-background"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(10,10,10,0.1) 0%, rgba(10,10,10,0.7) 60%, rgba(10,10,10,1) 100%), url(${event.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Neighborhood accent */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: neighborhoodConfig.color }}
        />

        {/* Local artist badge */}
        {event.isLocalArtist && (
          <div className="absolute top-4 right-4 px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider rounded">
            Local Artist
          </div>
        )}

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <NeighborhoodBadge
            neighborhood={event.venue.neighborhood}
            size="sm"
            className="mb-3"
          />

          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight leading-tight mb-1">
            {event.artist}
          </h2>

          <p className="text-base text-muted-foreground font-medium mb-3">
            {event.venue.name}
          </p>

          <div className="flex items-center gap-3 text-sm">
            <span>{formattedDate}</span>
            <span className="text-muted-foreground">·</span>
            <span>{event.time}</span>
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="p-5 space-y-4">
        {/* Price & Age */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PriceDisplay price={event.price} size="lg" />
            <AgeBadge age={event.ageRestriction} />
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1"
          >
            <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
              Tickets <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>

        {/* Genres */}
        <div className="flex flex-wrap gap-1.5">
          {event.genres.map((genre) => (
            <GenreTag key={genre} genre={genre} size="sm" />
          ))}
        </div>

        {/* Description preview */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {event.description}
        </p>

        {/* Why this show */}
        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Why this show?
          </p>
          <p className="text-sm">
            {event.isLocalArtist && "Local artist. "}
            {event.venue.capacity === "small" && "Intimate venue. "}
            {event.price === "free" && "Free show! "}
            {event.mood === "experimental" && "Unique sound. "}
            {event.popularity < 30 && "Hidden gem. "}
            {!event.isLocalArtist &&
              event.venue.capacity !== "small" &&
              event.price !== "free" &&
              "Great discovery potential."}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4 p-5 pt-0">
        <button
          onClick={onSkip}
          className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 transition-colors"
          aria-label="Skip"
        >
          <X className="w-6 h-6" />
        </button>

        <Link
          href={`/event/${event.id}`}
          className="flex-1 h-14 flex items-center justify-center rounded-full bg-secondary hover:bg-muted font-bold uppercase tracking-wide text-sm transition-colors"
        >
          View Details
        </Link>

        <button
          onClick={onSave}
          className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 transition-colors"
          aria-label="Save"
        >
          <Check className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}
