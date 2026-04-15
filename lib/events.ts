/**
 * Live event data layer — replaces the static lib/data.ts.
 *
 * Primary source:  Ticketmaster Discovery API (Minneapolis-St. Paul DMA 336)
 * Supplementary:   Venue scrapers (First Ave, Dakota, Acme, Hennepin Arts)
 * Disabled:        Bandsintown (API requires formal access approval)
 *
 * All fetches are server-side only (never called from the browser).
 * Caching is handled via unstable_cache (Next.js) at the function level,
 * which caches the compact normalized Event array rather than the raw ~3MB
 * Ticketmaster response (which exceeds Next.js's 2MB fetch-cache limit).
 */

import { unstable_cache } from "next/cache"
import type { Event, Neighborhood, Venue } from "./types"
import { fetchTMEvents, fetchTMEventById } from "./api/ticketmaster"
import { normalizeTMEvent } from "./api/normalize"
import { scrapeAllVenues, mergeWithPrimary } from "./scrapers"
import { batchGetArtistData } from "./api/spotify"
import { batchGetLastFmData, listenersToPopularity } from "./api/lastfm"

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isUpcoming(event: Event): boolean {
  const today = new Date().toISOString().split("T")[0]
  return event.date >= today
}

function sortByDate(events: Event[]): Event[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// Core fetch — gets all upcoming Minneapolis music events
// ---------------------------------------------------------------------------

/**
 * Fetches upcoming events from Ticketmaster (primary) and merges in unique
 * events from Bandsintown for headlining artists discovered via TM.
 *
 * Wrapped in unstable_cache so the compact normalized Event array is cached
 * for 1 hour — avoids re-hitting TM's 5000 req/day rate limit on every render.
 */
export const getAllEvents = unstable_cache(
  async (): Promise<Event[]> => {
    // Fetch TM events (music + comedy + sports) and scraper events in parallel
    const [tmRaw, scrapedEvents] = await Promise.all([
      fetchTMEvents({ size: 200 }),
      scrapeAllVenues(),
    ])

    const tmEvents = tmRaw.map(normalizeTMEvent).filter(isUpcoming)

    // Merge scrapers into TM results, deduplicating by artist+date
    const merged = mergeWithPrimary(tmEvents, scrapedEvents.filter(isUpcoming))

    // Enrich all events with Spotify artist data (image + genre/mood).
    // We fetch data for every unique artist so we can override vague default
    // genres (e.g. FA scraper defaults to "rock"/"indie" for everything).
    const PLACEHOLDER = "/placeholder-event.jpg"
    const allArtists = [...new Set(merged.map((e) => e.artist))]

    // Spotify first — critical path for images and genre. Always awaited.
    const spotifyData = allArtists.length > 0
      ? await batchGetArtistData(allArtists).catch(() => new Map<string, import("./api/spotify").SpotifyArtistData>())
      : new Map<string, import("./api/spotify").SpotifyArtistData>()

    // Second-pass Spotify lookup for compound names (e.g. "Waxahatchee & MJ Lenderman").
    // Extract the primary artist (before " & " / " with " / " feat") and look them up
    // if the full compound name got no result.
    const compoundMissing = allArtists.filter((name) => {
      if (spotifyData.has(name)) return false
      return /\s+(&|with|feat\.?)\s+/i.test(name)
    })
    if (compoundMissing.length > 0) {
      const primaryNames = compoundMissing.map((name) =>
        name.split(/\s+(&|with|feat\.?)\s+/i)[0].trim()
      )
      const fallbackData = await batchGetArtistData(primaryNames).catch(
        () => new Map<string, import("./api/spotify").SpotifyArtistData>()
      )
      // Store under the original compound name so the enrichment step finds it
      compoundMissing.forEach((compound, i) => {
        const primary = primaryNames[i]
        const data = fallbackData.get(primary)
        if (data) spotifyData.set(compound, data)
      })
    }

    // Last.fm — non-critical (popularity scores + tag fallback). Give it 10 s;
    // if it's still running after that, skip it for this cache cycle.
    const LASTFM_TIMEOUT = 10_000
    const lastFmData = allArtists.length > 0
      ? await Promise.race([
          batchGetLastFmData(allArtists).catch(() => new Map<string, import("./api/lastfm").LastFmArtistData>()),
          new Promise<Map<string, import("./api/lastfm").LastFmArtistData>>((resolve) =>
            setTimeout(() => resolve(new Map()), LASTFM_TIMEOUT)
          ),
        ])
      : new Map<string, import("./api/lastfm").LastFmArtistData>()

    const enriched = merged.map((e) => {
      const sd = spotifyData.get(e.artist)
      const ld = lastFmData.get(e.artist)
      const updates: Partial<typeof e> = {}

      if (sd) {
        // Fill in missing image from Spotify
        if ((!e.imageUrl || e.imageUrl === PLACEHOLDER) && sd.imageUrl) {
          updates.imageUrl = sd.imageUrl
        }

        // Override genre/mood when Spotify gives something more specific than
        // the scraper/TM blunt defaults ("rock" / "indie").
        const isDefaultGenre = e.genres.length === 1 &&
          (e.genres[0] === "rock" || e.genres[0] === "indie")

        if (sd.mappedGenre && (isDefaultGenre || sd.mappedGenre !== e.genres[0])) {
          updates.genres = [sd.mappedGenre]
          updates.mood = sd.mood ?? e.mood
        }
      }

      if (ld) {
        // Real popularity score from Last.fm listener count
        updates.popularity = listenersToPopularity(ld.listeners)

        // Use Last.fm tags as genre fallback when Spotify had no data and
        // the genre is still a blunt default
        const currentGenres = updates.genres ?? e.genres
        const isDefaultGenre = currentGenres.length === 1 &&
          (currentGenres[0] === "rock" || currentGenres[0] === "indie")

        if (!sd?.mappedGenre && ld.mappedGenre && isDefaultGenre) {
          updates.genres = [ld.mappedGenre]
        }
      }

      return Object.keys(updates).length > 0 ? { ...e, ...updates } : e
    })

    // Final dedup pass — catches TM returning the same show twice (common for
    // First Avenue sub-venues) and any artist-name mismatches that slipped
    // through mergeWithPrimary. Key on venue name (not ID) since TM and
    // scrapers assign different IDs to the same physical venue.
    // Keep the first occurrence; TM events come first so they win on conflict.
    const seenFinal = new Set<string>()
    const deduped = enriched.filter((e) => {
      const key = `${e.artist.toLowerCase().trim()}|${e.date}|${e.venue.name.toLowerCase().trim()}`
      if (seenFinal.has(key)) return false
      seenFinal.add(key)
      return true
    })

    return sortByDate(deduped)
  },
  ["all-events"],
  { revalidate: 3600 }
)

// ---------------------------------------------------------------------------
// Public API — mirrors the helpers that pages used from lib/data.ts
// ---------------------------------------------------------------------------

export async function getUpcomingEvents(limit?: number): Promise<Event[]> {
  const events = await getAllEvents()
  return limit ? events.slice(0, limit) : events
}

export async function getNext3DaysEvents(): Promise<Event[]> {
  const events = await getAllEvents()
  const today = new Date()
  const dates = new Set<string>()
  for (let i = 0; i < 3; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.add(d.toISOString().split("T")[0])
  }
  return events.filter((e) => dates.has(e.date))
}

export async function getEventById(id: string): Promise<Event | undefined> {
  // Try fetching directly from TM for fresh data on detail pages
  // Strip the "bit-" prefix for Bandsintown IDs
  if (!id.startsWith("bit-")) {
    try {
      const raw = await fetchTMEventById(id)
      if (raw) return normalizeTMEvent(raw)
    } catch {
      // Fall through to searching in-memory list
    }
  }

  // Fallback: search the cached full list (covers scraper-sourced events)
  const events = await getAllEvents()
  return events.find((e) => e.id === id)
}

export async function getVenueById(venueId: string): Promise<Venue | undefined> {
  const events = await getAllEvents()
  return events.find((e) => e.venue.id === venueId)?.venue
}

export async function getEventsByVenue(venueId: string): Promise<Event[]> {
  const events = await getAllEvents()
  return events.filter((e) => e.venue.id === venueId)
}

export async function getEventsByNeighborhood(
  neighborhood: Neighborhood
): Promise<Event[]> {
  const events = await getAllEvents()
  return events.filter((e) => e.venue.neighborhood === neighborhood)
}

export async function getTonightEvents(): Promise<Event[]> {
  const today = new Date().toISOString().split("T")[0]
  const events = await getAllEvents()
  return events.filter((e) => e.date === today)
}

export async function getWeekendEvents(): Promise<Event[]> {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...6=Sat

  // Find the coming Friday
  const daysUntilFriday = ((5 - day + 7) % 7) || 7
  const friday = new Date(now)
  friday.setDate(now.getDate() + (day === 5 || day === 6 || day === 0 ? 0 : daysUntilFriday))

  const sunday = new Date(friday)
  sunday.setDate(friday.getDate() + (day === 0 ? 0 : 2))

  const fridayStr = friday.toISOString().split("T")[0]
  const sundayStr = sunday.toISOString().split("T")[0]

  const events = await getAllEvents()
  return events.filter((e) => e.date >= fridayStr && e.date <= sundayStr)
}
