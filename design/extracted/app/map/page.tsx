"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { events } from "@/lib/data"
import { getEventCountsByNeighborhood } from "@/lib/filters"
import { neighborhoods } from "@/lib/neighborhoods"
import type { Neighborhood } from "@/lib/types"
import { NeighborhoodMap, NeighborhoodLegend } from "@/components/neighborhood-map"
import { EventCard } from "@/components/event-card"
import { MobileNav } from "@/components/mobile-nav"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"

export default function MapPage() {
  const [selectedHood, setSelectedHood] = useState<Neighborhood | null>(null)
  const eventCounts = getEventCountsByNeighborhood(events)

  // Get events for selected neighborhood
  const filteredEvents = selectedHood
    ? events
        .filter((e) => e.venue.neighborhood === selectedHood)
        .filter((e) => new Date(e.date) >= new Date())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6)
    : []

  const selectedHoodConfig = selectedHood
    ? neighborhoods.find((n) => n.id === selectedHood)
    : null

  return (
    <div className="min-h-screen pb-20">
      <SiteHeader />

      <div className="px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight">
            Explore by Neighborhood
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tap a neighborhood to see upcoming shows
          </p>
        </div>

        {/* Map */}
        <NeighborhoodMap eventCounts={eventCounts} />

        {/* Neighborhood Quick Select */}
        <div className="flex flex-wrap gap-2">
          {neighborhoods.map((hood) => (
            <button
              key={hood.id}
              onClick={() =>
                setSelectedHood(selectedHood === hood.id ? null : hood.id)
              }
              className={cn(
                "px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-sm border transition-all",
                selectedHood === hood.id
                  ? "border-transparent"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              )}
              style={
                selectedHood === hood.id
                  ? { backgroundColor: hood.color, color: hood.textColor }
                  : undefined
              }
            >
              {hood.name}
            </button>
          ))}
        </div>

        {/* Selected Neighborhood Shows */}
        {selectedHood && selectedHoodConfig && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-xl font-bold uppercase tracking-tight"
                  style={{ color: selectedHoodConfig.color }}
                >
                  {selectedHoodConfig.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {eventCounts[selectedHood] || 0} upcoming shows
                </p>
              </div>
              <Link
                href={`/events?neighborhood=${selectedHood}`}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                See all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {filteredEvents.length > 0 ? (
              <div className="space-y-2">
                {filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} variant="compact" />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No upcoming shows in this neighborhood
              </p>
            )}
          </div>
        )}

        {/* Legend */}
        {!selectedHood && (
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Legend
            </h3>
            <NeighborhoodLegend />
          </div>
        )}
      </div>

      <MobileNav />
    </div>
  )
}
