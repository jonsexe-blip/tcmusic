"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SlidersHorizontal, Grid, List, Calendar } from "lucide-react"
import { filterEvents, getDefaultFilters } from "@/lib/filters"
import type { Event, FilterState, Neighborhood, Venue } from "@/lib/types"
import { EventGrid } from "@/components/event-grid"
import { EventCard } from "@/components/event-card"
import { EventCalendar } from "@/components/event-calendar"
import { MobileNav } from "@/components/mobile-nav"
import { SiteHeader } from "@/components/site-header"
import { SearchBar } from "@/components/search-bar"
import { FilterSheet } from "@/components/filter-sheet"
import { MoodTag } from "@/components/genre-tag"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ViewMode = "grid" | "list"
type QuickFilter = "all" | "tonight" | "weekend"
type CategoryFilter = "all" | "music" | "comedy" | "sports" | "theater"

const SESSION_KEY = "events-page-state"

interface SavedState {
  filters: FilterState
  quickFilter: QuickFilter
  categoryFilter: CategoryFilter
  viewMode: ViewMode
}

function loadSavedState(): SavedState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SavedState) : null
  } catch {
    return null
  }
}

const MUSIC_GENRES = new Set([
  "rock", "punk", "metal", "indie", "folk", "country",
  "hip-hop", "r&b", "jazz", "electronic", "experimental",
  "pop", "soul", "blues", "classical", "world",
])

interface EventsClientProps {
  allEvents: Event[]
  tonightEvents: Event[]
  weekendEvents: Event[]
  venues: Venue[]
}

export default function EventsClient({
  allEvents,
  tonightEvents,
  weekendEvents,
  venues,
}: EventsClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initialize from URL params only (safe for SSR — no sessionStorage)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [selectedDate, setSelectedDate] = useState<string | undefined>(
    () => searchParams.get("date") ?? undefined
  )
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(() => {
    const p = searchParams.get("filter")
    if (p === "tonight") return "tonight"
    if (p === "weekend") return "weekend"
    return "all"
  })
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>(() => {
    const neighborhoodParam = searchParams.get("neighborhood")
    if (neighborhoodParam) {
      const defaults = getDefaultFilters()
      defaults.neighborhoods = [neighborhoodParam as Neighborhood]
      return defaults
    }
    return getDefaultFilters()
  })

  // After mount: restore saved state from sessionStorage (client-only, avoids hydration mismatch)
  useEffect(() => {
    const saved = loadSavedState()
    if (!saved) return
    setViewMode(saved.viewMode)
    setCategoryFilter(saved.categoryFilter)
    // Only restore filters/quickFilter if no URL param is overriding them
    if (!searchParams.get("filter")) setQuickFilter(saved.quickFilter)
    if (!searchParams.get("neighborhood")) setFilters(saved.filters)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    const state: SavedState = { filters, quickFilter, categoryFilter, viewMode }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
  }, [filters, quickFilter, categoryFilter, viewMode])

  // Handle quick filter changes from URL (client-side navigation)
  useEffect(() => {
    const filterParam = searchParams.get("filter")
    if (filterParam === "tonight") setQuickFilter("tonight")
    else if (filterParam === "weekend") setQuickFilter("weekend")
  }, [searchParams])

  // Handle date param from URL (e.g. navigating from home calendar)
  useEffect(() => {
    const dateParam = searchParams.get("date")
    if (dateParam) setSelectedDate(dateParam)
  }, [searchParams])

  // Get base events based on quick filter
  const baseEvents = useMemo(() => {
    switch (quickFilter) {
      case "tonight": return tonightEvents
      case "weekend": return weekendEvents
      default: return allEvents
    }
  }, [quickFilter, allEvents, tonightEvents, weekendEvents])

  // Apply category filter, user filters, then optional date filter
  const filteredEvents = useMemo(() => {
    const categoryFiltered = categoryFilter === "all"
      ? baseEvents
      : baseEvents.filter((e) => {
          if (categoryFilter === "comedy") return e.genres.includes("comedy")
          if (categoryFilter === "sports") return e.genres.includes("sports")
          if (categoryFilter === "theater") return e.genres.includes("theater")
          return e.genres.some((g) => MUSIC_GENRES.has(g))
        })
    const userFiltered = filterEvents(categoryFiltered, filters)
    if (selectedDate) return userFiltered.filter((e) => e.date === selectedDate)
    return userFiltered
  }, [baseEvents, categoryFilter, filters, selectedDate])

  // Count active filters
  const activeFilterCount =
    filters.genres.length +
    filters.neighborhoods.length +
    filters.venues.length +
    (filters.mood !== "all" ? 1 : 0) +
    (filters.ageRestriction !== "any" ? 1 : 0) +
    (filters.priceRange.min > 0 || filters.priceRange.max < 100 ? 1 : 0)

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }))
  }

  const handleQuickFilterChange = (filter: QuickFilter) => {
    setQuickFilter(filter)
    setSelectedDate(undefined)
    if (filter === "all") router.push("/events")
    else router.push(`/events?filter=${filter}`)
  }

  const handleDateSelect = (date: string) => {
    setSelectedDate((prev) => (prev === date ? undefined : date))
  }

  return (
    <div className="min-h-screen pb-20">
      <SiteHeader showSearch={false} />

      <div className="px-4 py-4 space-y-4">
        {/* Search */}
        <SearchBar
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Search artists, venues, genres..."
        />

        {/* Quick Filters & View Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
            {(["all", "tonight", "weekend"] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleQuickFilterChange(f)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-sm border whitespace-nowrap transition-all",
                  quickFilter === f
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                )}
              >
                {f === "all" ? "All Shows" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          {(["all", "music", "comedy", "sports", "theater"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-sm border whitespace-nowrap transition-all",
                categoryFilter === cat
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              )}
            >
              {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Mood Quick Filter + Filter Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
            {(["all", "heavy", "chill", "dancey", "experimental"] as const).map((mood) => (
              <MoodTag
                key={mood}
                mood={mood}
                active={filters.mood === mood}
                onClick={() => setFilters((prev) => ({ ...prev, mood }))}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(true)}
            className="shrink-0 gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-foreground text-background text-[10px] font-bold rounded">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Two-column layout: events left, calendar right */}
      <div className="px-4 pb-6 lg:grid lg:grid-cols-[1fr_260px] lg:gap-8 lg:items-start">
        {/* Left: events */}
        <div>
          {/* Date filter indicator */}
          {selectedDate && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">
                  {filteredEvents.length} show{filteredEvents.length !== 1 ? "s" : ""}
                </span>{" "}
                on {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                })}
              </p>
              <button
                onClick={() => setSelectedDate(undefined)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* Results count (when no date selected) */}
          {!selectedDate && (
            <p className="text-sm text-muted-foreground mb-3">
              {filteredEvents.length} show{filteredEvents.length !== 1 ? "s" : ""}
              {quickFilter === "tonight" && " tonight"}
              {quickFilter === "weekend" && " this weekend"}
            </p>
          )}

          {viewMode === "grid" ? (
            <EventGrid events={filteredEvents} columns={4} />
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} variant="compact" />
              ))}
            </div>
          )}

          {filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-xl font-bold text-muted-foreground">No shows found</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Try adjusting your filters or check back later for new shows
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setFilters(getDefaultFilters())
                  setQuickFilter("all")
                  setCategoryFilter("all")
                  setSelectedDate(undefined)
                  sessionStorage.removeItem(SESSION_KEY)
                }}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </div>

        {/* Right: sticky calendar sidebar (desktop only) */}
        <div className="hidden lg:block lg:sticky lg:top-[72px]">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
            Browse by Date
          </p>
          <EventCalendar
            events={allEvents}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </div>
      </div>

      {/* Filter Sheet */}
      <FilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onFiltersChange={setFilters}
        venues={venues}
      />

      <MobileNav />
    </div>
  )
}
