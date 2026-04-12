import type { Event, FilterState, Genre, GenreMood, Neighborhood } from "./types"
import { genreMoodMap } from "./types"

export function filterEvents(events: Event[], filters: FilterState): Event[] {
  return events.filter((event) => {
    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      const eventDate = new Date(event.date)
      if (filters.dateRange.start && eventDate < filters.dateRange.start) {
        return false
      }
      if (filters.dateRange.end && eventDate > filters.dateRange.end) {
        return false
      }
    }

    // Genre filter
    if (filters.genres.length > 0) {
      const hasMatchingGenre = event.genres.some((g) =>
        filters.genres.includes(g)
      )
      if (!hasMatchingGenre) {
        return false
      }
    }

    // Mood filter
    if (filters.mood !== "all") {
      // Check if any of the event's genres match the mood
      const eventMoods = event.genres.map((g) => genreMoodMap[g])
      if (!eventMoods.includes(filters.mood) && event.mood !== filters.mood) {
        return false
      }
    }

    // Neighborhood filter
    if (filters.neighborhoods.length > 0) {
      if (!filters.neighborhoods.includes(event.venue.neighborhood)) {
        return false
      }
    }

    // Price filter
    if (filters.priceRange.min > 0 || filters.priceRange.max < 100) {
      if (event.price === "tbd") {
        // Include TBD events only if max is high
        if (filters.priceRange.max < 50) return false
      } else if (event.price === "free") {
        if (filters.priceRange.min > 0) return false
      } else {
        if (
          event.price.min > filters.priceRange.max ||
          event.price.max < filters.priceRange.min
        ) {
          return false
        }
      }
    }

    // Age restriction filter
    if (filters.ageRestriction !== "any") {
      if (event.ageRestriction !== filters.ageRestriction) {
        return false
      }
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesArtist = event.artist.toLowerCase().includes(searchLower)
      const matchesVenue = event.venue.name.toLowerCase().includes(searchLower)
      const matchesGenre = event.genres.some((g) =>
        g.toLowerCase().includes(searchLower)
      )
      if (!matchesArtist && !matchesVenue && !matchesGenre) {
        return false
      }
    }

    return true
  })
}

export function getDefaultFilters(): FilterState {
  return {
    dateRange: { start: null, end: null },
    genres: [],
    mood: "all",
    neighborhoods: [],
    priceRange: { min: 0, max: 100 },
    ageRestriction: "any",
    search: "",
  }
}

// Discover algorithm - surfaces shows you might not know about
export function getDiscoverEvents(events: Event[], count: number = 10): Event[] {
  const today = new Date().toISOString().split("T")[0]
  const upcoming = events.filter((e) => e.date >= today)

  // Score each event for "discoverability"
  const scored = upcoming.map((event) => {
    let score = 0

    // Lower popularity = higher discover score
    score += (100 - event.popularity) * 2

    // Local artists get a boost
    if (event.isLocalArtist) score += 30

    // Smaller venues get a boost
    if (event.venue.capacity === "small") score += 25
    if (event.venue.capacity === "medium") score += 10

    // Free shows get a boost
    if (event.price === "free") score += 20

    // Experimental mood gets a boost
    if (event.mood === "experimental") score += 15

    // Add some randomness
    score += Math.random() * 30

    return { event, score }
  })

  // Sort by score descending and take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.event)
}

// Get random event for "Surprise Me" feature
export function getRandomEvent(events: Event[]): Event | null {
  const today = new Date().toISOString().split("T")[0]
  const upcoming = events.filter((e) => e.date >= today)
  if (upcoming.length === 0) return null
  return upcoming[Math.floor(Math.random() * upcoming.length)]
}

// Get event counts by neighborhood
export function getEventCountsByNeighborhood(
  events: Event[]
): Record<Neighborhood, number> {
  const counts: Record<string, number> = {}
  const today = new Date().toISOString().split("T")[0]
  const upcoming = events.filter((e) => e.date >= today)

  for (const event of upcoming) {
    const hood = event.venue.neighborhood
    counts[hood] = (counts[hood] || 0) + 1
  }

  return counts as Record<Neighborhood, number>
}

// Genre display names
export const genreDisplayNames: Record<Genre, string> = {
  rock: "Rock",
  punk: "Punk",
  metal: "Metal",
  indie: "Indie",
  folk: "Folk",
  country: "Country",
  "hip-hop": "Hip-Hop",
  "r&b": "R&B",
  jazz: "Jazz",
  electronic: "Electronic",
  experimental: "Experimental",
  pop: "Pop",
  soul: "Soul",
  blues: "Blues",
  classical: "Classical",
  comedy: "Comedy",
}

// Mood display names and descriptions
export const moodConfig: Record<
  GenreMood,
  { name: string; description: string }
> = {
  heavy: { name: "Heavy", description: "Loud, intense, cathartic" },
  chill: { name: "Chill", description: "Mellow, acoustic, laid-back" },
  dancey: { name: "Dancey", description: "Move your body, feel the beat" },
  experimental: { name: "Experimental", description: "Weird, avant-garde, surprising" },
  all: { name: "All Moods", description: "Everything" },
}
