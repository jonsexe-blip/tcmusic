/**
 * Setlist.fm API — historical concert setlists
 *
 * Used on event detail pages to show what songs the artist played at their
 * most recent show (ideally at the same venue, otherwise anywhere).
 *
 * Requires x-api-key header. Free for non-commercial use.
 * Docs: https://api.setlist.fm/docs/1.0/index.html
 */

const BASE_URL = "https://api.setlist.fm/rest/1.0"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SetlistSong {
  name: string
  cover?: { name: string; mbid?: string } // cover song — original artist
  info?: string                            // e.g. "extended version"
  tape?: boolean                           // played from tape, not live
}

export interface SetlistData {
  eventDate: string        // "dd-MM-yyyy" format from API
  venueName: string
  cityName: string
  songs: SetlistSong[]
  setlistUrl: string
  tourName?: string
}

// ---------------------------------------------------------------------------
// Internal API shapes
// ---------------------------------------------------------------------------

interface SFMSong {
  name: string
  cover?: { name: string; mbid?: string }
  info?: string
  tape?: boolean
}

interface SFMSet {
  song?: SFMSong[]
  encore?: number
}

interface SFMSetlist {
  id: string
  eventDate: string
  url: string
  venue: { name: string; city: { name: string; country: { code: string } } }
  sets: { set: SFMSet[] }
  tour?: { name: string }
}

interface SFMResponse {
  setlist?: SFMSetlist[]
  total?: number
  page?: number
  itemsPerPage?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractSongs(sets: { set: SFMSet[] }): SetlistSong[] {
  const songs: SetlistSong[] = []
  for (const set of sets.set ?? []) {
    for (const song of set.song ?? []) {
      if (!song.tape) { // skip taped/pre-recorded tracks
        songs.push({
          name: song.name,
          cover: song.cover,
          info: song.info,
        })
      }
    }
  }
  return songs
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the most recent setlist for an artist.
 * If venueName is provided, prefers a setlist from that venue but falls back
 * to the most recent show anywhere if no venue match is found.
 */
export async function getRecentSetlist(
  artistName: string,
  venueName?: string
): Promise<SetlistData | null> {
  const apiKey = process.env.SETLISTFM_API_KEY
  if (!apiKey) return null

  const params = new URLSearchParams({
    artistName,
    p: "1",
  })

  try {
    const res = await fetch(`${BASE_URL}/search/setlists?${params}`, {
      cache: "no-store",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    })
    if (!res.ok) return null

    const data: SFMResponse = await res.json()
    const setlists = data.setlist ?? []

    // Filter out setlists with no songs
    const withSongs = setlists.filter(
      (s) => s.sets?.set?.some((set) => (set.song?.length ?? 0) > 0)
    )
    if (withSongs.length === 0) return null

    // Prefer a match at the same venue
    let best: SFMSetlist | undefined
    if (venueName) {
      const normalVenue = normalizeName(venueName)
      best = withSongs.find((s) =>
        normalizeName(s.venue.name).includes(normalVenue) ||
        normalVenue.includes(normalizeName(s.venue.name))
      )
    }
    // Fall back to most recent show anywhere
    if (!best) best = withSongs[0]
    if (!best) return null

    return {
      eventDate: best.eventDate,
      venueName: best.venue.name,
      cityName: best.venue.city.name,
      songs: extractSongs(best.sets),
      setlistUrl: best.url,
      tourName: best.tour?.name,
    }
  } catch {
    return null
  }
}
