/**
 * Hennepin Theatre Trust / Hennepin Arts scraper
 * Source: Contentful CMS (public delivery API — token embedded in page JS)
 *
 * Covers: Orpheum Theatre, State Theatre, Pantages Theatre, The Hennepin,
 *         Dudley Riggs Theatre
 *
 * Space: sjxdiqjbm079
 * Token: tD1D9O87XnngGuRfQwMyD8rbM83-1h-R4fzWdkamosk (public delivery token)
 */

import type { Event, Venue, Genre } from "../types"
import { genreMoodMap } from "../types"
import { mapLatLngToNeighborhood } from "../api/normalize"

const CONTENTFUL_BASE = "https://cdn.contentful.com"
const SPACE_ID = "sjxdiqjbm079"
const ACCESS_TOKEN = "tD1D9O87XnngGuRfQwMyD8rbM83-1h-R4fzWdkamosk"

// ---------------------------------------------------------------------------
// Venue registry (Contentful entry ID → Venue)
// ---------------------------------------------------------------------------

const HA_VENUES: Record<string, Omit<Venue, "id">> = {
  "5HMLmnbK0DlTGamJ9DgTix": {
    name: "Orpheum Theatre",
    neighborhood: "downtown-mpls",
    address: "910 Hennepin Ave, Minneapolis, MN 55403",
    capacity: "large",
  },
  "1TkA6iQOdKU7pYQupdrsIn": {
    name: "State Theatre",
    neighborhood: "downtown-mpls",
    address: "805 Hennepin Ave, Minneapolis, MN 55402",
    capacity: "medium",
  },
  "6y2KldAzRyd7gYc8B5LV2R": {
    name: "Pantages Theatre",
    neighborhood: "downtown-mpls",
    address: "710 Hennepin Ave, Minneapolis, MN 55403",
    capacity: "medium",
  },
  "y2v4nwz3hbPcefsZ6a4Ch": {
    name: "The Hennepin",
    neighborhood: "downtown-mpls",
    address: "900 Hennepin Ave, Minneapolis, MN 55403",
    capacity: "medium",
  },
  "7jLjPUWWgTx9H2yflSsqGi": {
    name: "Dudley Riggs Theatre",
    neighborhood: "downtown-mpls",
    address: "824 Hennepin Ave, Minneapolis, MN 55403",
    capacity: "small",
  },
}

function resolveVenue(venueEntryId?: string): Venue {
  if (venueEntryId && HA_VENUES[venueEntryId]) {
    return { id: `ha-${venueEntryId}`, ...HA_VENUES[venueEntryId] }
  }
  return {
    id: "ha-unknown",
    name: "Hennepin Arts",
    neighborhood: "downtown-mpls",
    address: "Minneapolis, MN",
    capacity: "medium",
  }
}

// ---------------------------------------------------------------------------
// Genre mapping
// ---------------------------------------------------------------------------

const GENRE_MAP: Record<string, Genre> = {
  "Rock": "rock",
  "Pop": "pop",
  "Hip Hop": "hip-hop",
  "Hip-Hop": "hip-hop",
  "Jazz": "jazz",
  "Blues": "blues",
  "Country": "country",
  "Folk": "folk",
  "Electronic": "electronic",
  "R&B": "r&b",
  "Classical": "classical",
  "Soul": "soul",
  "Comedy": "comedy",
  "Theater": "theater",
  "Theatre": "theater",
  "Dance": "theater",
  "Ballet": "theater",
  "Opera": "theater",
  "Broadway": "theater",
  "Family": "pop",
}

function mapGenre(genreStr?: string): Genre {
  if (!genreStr) return "rock"
  for (const [key, val] of Object.entries(GENRE_MAP)) {
    if (genreStr.toLowerCase().includes(key.toLowerCase())) return val
  }
  return "rock"
}

// ---------------------------------------------------------------------------
// Contentful types
// ---------------------------------------------------------------------------

interface CFLink {
  sys: { type: "Link"; linkType: string; id: string }
}

interface CFEventFields {
  name: string
  slug: string
  genre?: string
  startDate?: string     // "YYYY-MM-DD"
  endDate?: string
  shortDescription?: string
  venue?: CFLink
  image?: CFLink
}

interface CFEntry {
  sys: { id: string }
  fields: CFEventFields
}

interface CFAsset {
  sys: { id: string }
  fields: { file?: { url: string } }
}

interface CFResponse {
  total: number
  skip: number
  limit: number
  items: CFEntry[]
  includes?: {
    Asset?: CFAsset[]
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUpcoming(dateStr?: string): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr) >= today
}

function buildEventUrl(slug: string): string {
  return `https://hennepinarts.org/events/${slug}/`
}

// ---------------------------------------------------------------------------
// Fetch one page
// ---------------------------------------------------------------------------

async function fetchPage(skip: number, assetMap: Map<string, string>): Promise<CFResponse> {
  const params = new URLSearchParams({
    content_type: "event",
    limit: "200",
    skip: String(skip),
    include: "1",                // include linked assets (images)
    "fields.startDate[gte]": new Date().toISOString().split("T")[0],
    order: "fields.startDate",
    access_token: ACCESS_TOKEN,
  })
  const url = `${CONTENTFUL_BASE}/spaces/${SPACE_ID}/environments/master/entries?${params}`
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
  })
  if (!res.ok) throw new Error(`Hennepin Arts Contentful fetch failed: ${res.status}`)
  const data: CFResponse = await res.json()

  // Populate asset map from includes
  for (const asset of data.includes?.Asset ?? []) {
    const url = asset.fields.file?.url
    if (url) assetMap.set(asset.sys.id, url.startsWith("//") ? `https:${url}` : url)
  }

  return data
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export async function scrapeHennepinArts(): Promise<Event[]> {
  const events: Event[] = []
  const assetMap = new Map<string, string>()
  let skip = 0
  let total = Infinity

  while (skip < total) {
    try {
      const data = await fetchPage(skip, assetMap)
      total = data.total
      skip += data.limit

      for (const entry of data.items) {
        try {
          const f = entry.fields
          if (!f.startDate || !isUpcoming(f.startDate)) continue

          const artist = f.name.trim()
          const genre = mapGenre(f.genre)
          const venueEntryId = f.venue?.sys.id
          const venue = resolveVenue(venueEntryId)
          const imageAssetId = f.image?.sys.id
          const imageUrl = imageAssetId && assetMap.has(imageAssetId)
            ? assetMap.get(imageAssetId)!
            : "/placeholder-event.jpg"

          events.push({
            id: `ha-${entry.sys.id}`,
            artist,
            venue,
            date: f.startDate,
            time: "TBA",
            price: "tbd",
            ageRestriction: "all-ages",
            genres: [genre],
            mood: genreMoodMap[genre] ?? "chill",
            ticketUrl: buildEventUrl(f.slug),
            imageUrl,
            description: f.shortDescription?.slice(0, 300) ?? `${artist} at ${venue.name}.`,
            popularity: 60,
            isLocalArtist: false,
          })
        } catch {
          // Skip malformed entries
        }
      }

      if (data.items.length < data.limit) break
    } catch {
      break
    }
  }

  return events
}
