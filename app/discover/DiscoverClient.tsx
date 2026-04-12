"use client"

import { useState, useMemo, useCallback } from "react"
import { Shuffle, Sparkles, Info } from "lucide-react"
import type { Event } from "@/lib/types"
import { getDiscoverEvents, getRandomEvent } from "@/lib/filters"
import { DiscoverCard } from "@/components/discover-card"
import { EventCard } from "@/components/event-card"
import { MobileNav } from "@/components/mobile-nav"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DiscoverClientProps {
  allEvents: Event[]
}

export default function DiscoverClient({ allEvents }: DiscoverClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [showInfo, setShowInfo] = useState(false)

  // Get discover events, excluding skipped ones
  const discoverEvents = useMemo(() => {
    return getDiscoverEvents(allEvents, 20).filter((e) => !skippedIds.has(e.id))
  }, [allEvents, skippedIds])

  const currentEvent = discoverEvents[currentIndex]

  const handleSkip = useCallback(() => {
    if (currentEvent) {
      setSkippedIds((prev) => new Set(prev).add(currentEvent.id))
    }
    // Move to next card (the list will update due to filter)
  }, [currentEvent])

  const handleSave = useCallback(() => {
    if (currentEvent) {
      setSavedIds((prev) => new Set(prev).add(currentEvent.id))
    }
    // Move to next
    setCurrentIndex((prev) =>
      prev + 1 >= discoverEvents.length ? 0 : prev + 1
    )
  }, [currentEvent, discoverEvents.length])

  const handleSurpriseMe = useCallback(() => {
    const random = getRandomEvent(
      allEvents.filter((e) => !skippedIds.has(e.id) && !savedIds.has(e.id))
    )
    if (random) {
      const idx = discoverEvents.findIndex((e) => e.id === random.id)
      if (idx !== -1) {
        setCurrentIndex(idx)
      }
    }
  }, [discoverEvents, skippedIds, savedIds])

  const savedEvents = allEvents.filter((e) => savedIds.has(e.id))

  return (
    <div className="min-h-screen pb-20">
      <SiteHeader />

      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Discover
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Shows you might not know about
            </p>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showInfo
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Toggle info"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* Info panel */}
        {showInfo && (
          <div className="mb-6 p-4 rounded-lg bg-secondary/50 border border-border">
            <h3 className="font-bold mb-2">How Discover Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>
                <span className="text-foreground font-medium">Lower profile shows</span>{" "}
                - events that might fly under the radar
              </li>
              <li>
                <span className="text-foreground font-medium">Local artists</span>{" "}
                - homegrown Twin Cities talent
              </li>
              <li>
                <span className="text-foreground font-medium">Smaller venues</span>{" "}
                - intimate rooms and bars
              </li>
              <li>
                <span className="text-foreground font-medium">Free shows</span>{" "}
                - no cover, no excuses
              </li>
              <li>
                <span className="text-foreground font-medium">Experimental</span>{" "}
                - weird and wonderful sounds
              </li>
            </ul>
          </div>
        )}

        {/* Surprise Me button */}
        <Button
          variant="outline"
          className="w-full mb-6 gap-2"
          onClick={handleSurpriseMe}
        >
          <Shuffle className="w-4 h-4" />
          Surprise Me
        </Button>

        {/* Current discover card */}
        {currentEvent ? (
          <DiscoverCard
            event={currentEvent}
            onSkip={handleSkip}
            onSave={handleSave}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-xl font-bold">You&apos;ve seen them all!</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              Check back later for new discoveries, or reset your skipped shows.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSkippedIds(new Set())
                setCurrentIndex(0)
              }}
            >
              Reset & Start Over
            </Button>
          </div>
        )}

        {/* Progress indicator */}
        {discoverEvents.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              {currentIndex + 1} of {discoverEvents.length} discoveries
            </p>
            <div className="flex justify-center gap-1 mt-2">
              {discoverEvents.slice(0, 10).map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    idx === currentIndex
                      ? "bg-foreground"
                      : idx < currentIndex
                        ? "bg-muted-foreground/50"
                        : "bg-muted"
                  )}
                />
              ))}
              {discoverEvents.length > 10 && (
                <span className="text-[10px] text-muted-foreground ml-1">
                  +{discoverEvents.length - 10}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Saved shows */}
        {savedEvents.length > 0 && (
          <div className="mt-10 pt-6 border-t border-border">
            <h2 className="text-lg font-bold uppercase tracking-tight mb-4">
              Saved ({savedEvents.length})
            </h2>
            <div className="space-y-2">
              {savedEvents.map((event) => (
                <EventCard key={event.id} event={event} variant="compact" />
              ))}
            </div>
          </div>
        )}
      </div>

      <MobileNav />
    </div>
  )
}
