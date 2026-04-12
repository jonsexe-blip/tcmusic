"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { MoodTag } from "./genre-tag"
import { NeighborhoodBadge } from "./neighborhood-badge"
import { neighborhoods } from "@/lib/neighborhoods"
import { genreDisplayNames, moodConfig, getDefaultFilters } from "@/lib/filters"
import type { FilterState, Genre, GenreMood, Neighborhood, AgeRestriction } from "@/lib/types"
import { cn } from "@/lib/utils"

interface FilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
}

const genres: Genre[] = [
  "rock", "punk", "metal", "indie", "folk", "country",
  "hip-hop", "r&b", "jazz", "electronic", "experimental",
  "pop", "soul", "blues", "classical", "comedy"
]

const moods: GenreMood[] = ["all", "heavy", "chill", "dancey", "experimental"]

const ageOptions: { value: AgeRestriction | "any"; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "all-ages", label: "All Ages" },
  { value: "18+", label: "18+" },
  { value: "21+", label: "21+" },
]

export function FilterSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters)

  const handleReset = () => {
    const defaults = getDefaultFilters()
    setLocalFilters(defaults)
  }

  const handleApply = () => {
    onFiltersChange(localFilters)
    onOpenChange(false)
  }

  const toggleGenre = (genre: Genre) => {
    setLocalFilters((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre],
    }))
  }

  const toggleNeighborhood = (neighborhood: Neighborhood) => {
    setLocalFilters((prev) => ({
      ...prev,
      neighborhoods: prev.neighborhoods.includes(neighborhood)
        ? prev.neighborhoods.filter((n) => n !== neighborhood)
        : [...prev.neighborhoods, neighborhood],
    }))
  }

  const activeFilterCount =
    localFilters.genres.length +
    localFilters.neighborhoods.length +
    (localFilters.mood !== "all" ? 1 : 0) +
    (localFilters.ageRestriction !== "any" ? 1 : 0) +
    (localFilters.priceRange.min > 0 || localFilters.priceRange.max < 100 ? 1 : 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
        <SheetHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold uppercase tracking-tight">
              Filters
            </SheetTitle>
            {activeFilterCount > 0 && (
              <button
                onClick={handleReset}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset all
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Mood */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3">
              Mood
            </h3>
            <div className="flex flex-wrap gap-2">
              {moods.map((mood) => (
                <MoodTag
                  key={mood}
                  mood={mood}
                  active={localFilters.mood === mood}
                  onClick={() =>
                    setLocalFilters((prev) => ({ ...prev, mood }))
                  }
                />
              ))}
            </div>
          </section>

          {/* Genres */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3">
              Genres
            </h3>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-sm border transition-all",
                    localFilters.genres.includes(genre)
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  {genreDisplayNames[genre]}
                </button>
              ))}
            </div>
          </section>

          {/* Neighborhoods */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3">
              Neighborhoods
            </h3>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((hood) => (
                <button
                  key={hood.id}
                  onClick={() => toggleNeighborhood(hood.id)}
                  className={cn(
                    "transition-opacity",
                    localFilters.neighborhoods.length > 0 &&
                      !localFilters.neighborhoods.includes(hood.id) &&
                      "opacity-40"
                  )}
                >
                  <NeighborhoodBadge neighborhood={hood.id} size="md" />
                </button>
              ))}
            </div>
          </section>

          {/* Price Range */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3">
              Price Range
            </h3>
            <div className="px-2">
              <Slider
                value={[localFilters.priceRange.min, localFilters.priceRange.max]}
                min={0}
                max={100}
                step={5}
                onValueChange={([min, max]) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    priceRange: { min, max },
                  }))
                }
                className="mb-2"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {localFilters.priceRange.min === 0
                    ? "Free"
                    : `$${localFilters.priceRange.min}`}
                </span>
                <span>
                  {localFilters.priceRange.max >= 100
                    ? "$100+"
                    : `$${localFilters.priceRange.max}`}
                </span>
              </div>
            </div>
          </section>

          {/* Age Restriction */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3">
              Age Restriction
            </h3>
            <div className="flex flex-wrap gap-2">
              {ageOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      ageRestriction: option.value,
                    }))
                  }
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-sm border transition-all",
                    localFilters.ageRestriction === option.value
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <SheetFooter className="border-t border-border pt-4">
          <Button
            onClick={handleApply}
            className="w-full h-12 text-base font-bold uppercase tracking-wide"
          >
            Apply Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-background/20 rounded text-sm">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
