"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SlidersHorizontal, Grid, List, Calendar } from "lucide-react"
import { events, getUpcomingEvents, getTonightEvents, getWeekendEvents } from "@/lib/data"
import { filterEvents, getDefaultFilters } from "@/lib/filters"
import type { FilterState, Neighborhood } from "@/lib/types"
import { EventGrid } from "@/components/event-grid"
import { EventCard } from "@/components/event-card"
import { MobileNav } from "@/components/mobile-nav"
import { SiteHeader } from "@/components/site-header"
import { SearchBar } from "@/components/search-bar"
import { FilterSheet } from "@/components/filter-sheet"
import { MoodTag } from "@/components/genre-tag"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ViewMode = "grid" | "list"
type QuickFilter = "all" | "tonight" | "weekend"

export default function EventsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>(() => {
    const defaults = getDefaultFilters()

    // Check for neighborhood param
    const neighborhoodParam = searchParams.get("neighborhood")
    if (neighborhoodParam) {
      defaults.neighborhoods = [neighborhoodParam as Neighborhood]
    }

    // Check for filter param
    const filterParam = searchParams.get("filter")
    if (filterParam === "tonight" || filterParam === "weekend") {
      // We'll handle this in quickFilter state
    }

    return defaults
  })

  // Handle quick filter from URL
  useEffect(() => {
    const filterParam = searchParams.get("filter")
    if (filterParam === "tonight") {
      setQuickFilter("tonight")
    } else if (filterParam === "weekend") {
      setQuickFilter("weekend")
    }
  }, [searchParams])

  // Get base events based on quick filter
  const baseEvents = useMemo(() => {
    switch (quickFilter) {
      case "tonight":
        return getTonightEvents()
      case "weekend":
        return getWeekendEvents()
      default:
        return getUpcomingEvents()
    }
  }, [quickFilter])

  // Apply filters
  const filteredEvents = useMemo(() => {
    return filterEvents(baseEvents, filters)
  }, [baseEvents, filters])

  // Count active filters
  const activeFilterCount =
    filters.genres.length +
    filters.neighborhoods.length +
    (filters.mood !== "all" ? 1 : 0) +
    (filters.ageRestriction !== "any" ? 1 : 0) +
    (filters.priceRange.min > 0 || filters.priceRange.max < 100 ? 1 : 0)

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }))
  }

  const handleQuickFilterChange = (filter: QuickFilter) => {
    setQuickFilter(filter)
    // Update URL
    if (filter === "all") {
      router.push("/events")
    } else {
      router.push(`/events?filter=${filter}`)
    }
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
            <button
              onClick={() => handleQuickFilterChange("all")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-sm border whitespace-nowrap transition-all",
                quickFilter === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              )}
            >
              All Shows
            </button>
            <button
              onClick={() => handleQuickFilterChange("tonight")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-sm border whitespace-nowrap transition-all",
                quickFilter === "tonight"
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              )}
            >
              Tonight
            </button>
            <button
              onClick={() => handleQuickFilterChange("weekend")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-sm border whitespace-nowrap transition-all",
                quickFilter === "weekend"
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              )}
            >
              Weekend
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "grid"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mood Quick Filter + Filter Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
            {(["all", "heavy", "chill", "dancey", "experimental"] as const).map(
              (mood) => (
                <MoodTag
                  key={mood}
                  mood={mood}
                  active={filters.mood === mood}
                  onClick={() => setFilters((prev) => ({ ...prev, mood }))}
                />
              )
            )}
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

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredEvents.length} show{filteredEvents.length !== 1 ? "s" : ""}
            {quickFilter === "tonight" && " tonight"}
            {quickFilter === "weekend" && " this weekend"}
          </p>
        </div>
      </div>

      {/* Events List/Grid */}
      <div className="px-4 pb-6">
        {viewMode === "grid" ? (
          <EventGrid events={filteredEvents} />
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
            <p className="text-xl font-bold text-muted-foreground">
              No shows found
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              Try adjusting your filters or check back later for new shows
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setFilters(getDefaultFilters())
                setQuickFilter("all")
              }}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      <FilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <MobileNav />
    </div>
  )
}
