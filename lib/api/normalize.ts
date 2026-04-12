import type { Event, Genre, Neighborhood, Venue, VenueCapacity, EventPrice, AgeRestriction, GenreMood } from "../types"
import { genreMoodMap } from "../types"
import type { TMEvent, TMVenue, BITArtistEvent } from "./types"

// ---------------------------------------------------------------------------
// Genre mapping
// ---------------------------------------------------------------------------

const TM_GENRE_MAP: Record<string, Genre> = {
  rock: "rock",
  "alternative rock": "rock",
  alternative: "indie",
  indie: "indie",
  "indie rock": "indie",
  pop: "pop",
  "pop/rock": "pop",
  "hip-hop/rap": "hip-hop",
  "hip-hop": "hip-hop",
  rap: "hip-hop",
  "r&b": "r&b",
  "r&b/soul": "r&b",
  soul: "soul",
  jazz: "jazz",
  blues: "blues",
  country: "country",
  folk: "folk",
  "folk/americana": "folk",
  americana: "folk",
  electronic: "electronic",
  "electronic/dance": "electronic",
  dance: "electronic",
  edm: "electronic",
  metal: "metal",
  "heavy metal": "metal",
  punk: "punk",
  "punk rock": "punk",
  classical: "classical",
  comedy: "comedy",
  experimental: "experimental",
  "new age": "experimental",
  reggae: "soul",
  latin: "pop",
  gospel: "soul",
  "world music": "folk",
  // Sports classifications
  sports: "sports",
  "nhl hockey": "sports",
  "nba basketball": "sports",
  "nfl football": "sports",
  "mlb baseball": "sports",
  "nfl": "sports",
  "nba": "sports",
  "nhl": "sports",
  "mlb": "sports",
  hockey: "sports",
  basketball: "sports",
  football: "sports",
  baseball: "sports",
  soccer: "sports",
  "minor league": "sports",
}

export function mapTMGenre(
  classifications: TMEvent["classifications"]
): Genre[] {
  const genres = new Set<Genre>()

  for (const cls of classifications ?? []) {
    const segmentName = cls.segment?.name?.toLowerCase()
    const genreName = cls.genre?.name?.toLowerCase()
    const subGenreName = cls.subGenre?.name?.toLowerCase()

    // Sports events: segment = "Sports", genre = sport type
    if (segmentName === "sports") {
      genres.add("sports")
      continue
    }

    if (genreName && TM_GENRE_MAP[genreName]) {
      genres.add(TM_GENRE_MAP[genreName])
    }
    if (subGenreName && TM_GENRE_MAP[subGenreName]) {
      genres.add(TM_GENRE_MAP[subGenreName])
    }
  }

  return genres.size > 0 ? Array.from(genres) : ["rock"]
}

// ---------------------------------------------------------------------------
// Neighborhood mapping (lat/lon bounding boxes)
// ---------------------------------------------------------------------------

interface BoundingBox {
  id: Neighborhood
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

// Approximate bounding boxes for Twin Cities neighborhoods
const NEIGHBORHOOD_BOXES: BoundingBox[] = [
  { id: "north-loop",       minLat: 44.982, maxLat: 44.999, minLon: -93.295, maxLon: -93.262 },
  { id: "downtown-mpls",    minLat: 44.967, maxLat: 44.985, minLon: -93.285, maxLon: -93.245 },
  { id: "ne-mpls",          minLat: 44.990, maxLat: 45.060, minLon: -93.270, maxLon: -93.195 },
  { id: "dinkytown",        minLat: 44.978, maxLat: 45.000, minLon: -93.240, maxLon: -93.205 },
  { id: "seward",           minLat: 44.945, maxLat: 44.970, minLon: -93.230, maxLon: -93.195 },
  { id: "uptown",           minLat: 44.935, maxLat: 44.968, minLon: -93.320, maxLon: -93.280 },
  { id: "south-mpls",       minLat: 44.882, maxLat: 44.945, minLon: -93.310, maxLon: -93.225 },
  { id: "midway",           minLat: 44.942, maxLat: 44.972, minLon: -93.175, maxLon: -93.110 },
  { id: "st-paul-downtown", minLat: 44.930, maxLat: 44.960, minLon: -93.115, maxLon: -93.070 },
  { id: "west-7th",         minLat: 44.918, maxLat: 44.945, minLon: -93.145, maxLon: -93.110 },
  { id: "highland-park",    minLat: 44.904, maxLat: 44.933, minLon: -93.205, maxLon: -93.140 },
]

export function mapLatLngToNeighborhood(
  lat: number,
  lon: number
): Neighborhood {
  for (const box of NEIGHBORHOOD_BOXES) {
    if (
      lat >= box.minLat &&
      lat <= box.maxLat &&
      lon >= box.minLon &&
      lon <= box.maxLon
    ) {
      return box.id
    }
  }
  return "suburbs"
}

// ---------------------------------------------------------------------------
// Venue capacity heuristic (based on typical Twin Cities venue sizes)
// ---------------------------------------------------------------------------

function inferCapacity(venueName: string, venueCity: string): VenueCapacity {
  const name = venueName.toLowerCase()

  // Large: arenas, amphitheaters, big halls
  if (
    name.includes("arena") ||
    name.includes("amphitheater") ||
    name.includes("amphitheatre") ||
    name.includes("stadium") ||
    name.includes("xcel") ||
    name.includes("target center") ||
    name.includes("us bank")
  ) {
    return "large"
  }

  // Medium: mid-size clubs and theaters (500-2000)
  if (
    name.includes("first avenue") ||
    name.includes("palace theatre") ||
    name.includes("State Theatre") ||
    name.includes("orpheum") ||
    name.includes("myth") ||
    name.includes("skyway theatre") ||
    name.includes("varsity") ||
    name.includes("summit") ||
    name.includes("theater") ||
    name.includes("theatre") ||
    name.includes("hall") ||
    name.includes("ballroom")
  ) {
    return "medium"
  }

  // Default small for bars, clubs, intimate venues
  return "small"
}

// ---------------------------------------------------------------------------
// Price mapping
// ---------------------------------------------------------------------------

export function mapTMPrice(
  priceRanges: TMEvent["priceRanges"]
): EventPrice | "free" | "tbd" {
  if (!priceRanges || priceRanges.length === 0) return "tbd"

  const facePrices = priceRanges.filter((p) => p.type === "standard" || p.type === "face value")
  const range = facePrices.length > 0 ? facePrices[0] : priceRanges[0]

  if (range.min === 0 && range.max === 0) return "free"
  return { min: range.min, max: range.max }
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatLocalTime(localTime: string | undefined): string {
  if (!localTime) return "TBA"

  const [hourStr, minuteStr] = localTime.split(":")
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr ?? "00"
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${minute} ${period}`
}

// ---------------------------------------------------------------------------
// Venue normalization
// ---------------------------------------------------------------------------

export function mapTMVenue(tmVenue: TMVenue): Venue {
  const lat = parseFloat(tmVenue.location?.latitude ?? "0")
  const lon = parseFloat(tmVenue.location?.longitude ?? "0")
  const neighborhood = mapLatLngToNeighborhood(lat, lon)

  const address = [
    tmVenue.address?.line1,
    tmVenue.address?.line2,
    tmVenue.city?.name,
    tmVenue.state?.stateCode,
    tmVenue.postalCode,
  ]
    .filter(Boolean)
    .join(", ")

  return {
    id: tmVenue.id,
    name: tmVenue.name,
    neighborhood,
    address,
    capacity: inferCapacity(tmVenue.name, tmVenue.city?.name ?? ""),
  }
}

// ---------------------------------------------------------------------------
// Age restriction
// ---------------------------------------------------------------------------

function inferAgeRestriction(
  tmEvent: TMEvent
): AgeRestriction {
  const info = [tmEvent.info, tmEvent.pleaseNote].join(" ").toLowerCase()

  if (info.includes("21+") || info.includes("21 and over") || info.includes("21 & over")) {
    return "21+"
  }
  if (info.includes("18+") || info.includes("18 and over") || info.includes("18 & over")) {
    return "18+"
  }
  if (tmEvent.ageRestrictions?.legalAgeEnforced) {
    return "21+"
  }
  return "all-ages"
}

// ---------------------------------------------------------------------------
// Image selection (prefer 16:9 ratio, medium size)
// ---------------------------------------------------------------------------

function selectImage(images: TMEvent["images"]): string {
  if (!images || images.length === 0) return "/placeholder-event.jpg"

  const preferred = images.find((img) => img.ratio === "16_9" && img.width >= 640 && !img.fallback)
  const fallback = images.find((img) => img.ratio === "16_9")
  const any = images[0]
  return (preferred ?? fallback ?? any)?.url ?? "/placeholder-event.jpg"
}

// ---------------------------------------------------------------------------
// Mood derivation
// ---------------------------------------------------------------------------

function deriveMood(genres: Genre[]): GenreMood {
  if (genres.length === 0) return "all"
  return genreMoodMap[genres[0]] ?? "all"
}

// ---------------------------------------------------------------------------
// Known local Twin Cities artists (used to set isLocalArtist)
// ---------------------------------------------------------------------------

const LOCAL_ARTISTS = new Set([
  "prince",
  "atmosphere",
  "slug",
  "rhymesayers",
  "eyedea",
  "brother ali",
  "dessa",
  "heiruspecs",
  "trampled by turtles",
  "the replacements",
  "husker du",
  "soul asylum",
  "the hold steady",
  "dillinger four",
  "lolo",
  "lizzo",
  "mike gordon",
  "hippocampus",
  "the cactus blossoms",
  "jeremy messersmith",
  "haley bonar",
  "the honeydogs",
  "romantica",
  "charlie parr",
  "low",
  "gaelynn lea",
  "tapes n tapes",
  "clouds",
  "lazerbeak",
  "sims",
  "p.o.s",
  "plain ole bill",
])

function isLocalArtist(artistName: string): boolean {
  return LOCAL_ARTISTS.has(artistName.toLowerCase())
}

// ---------------------------------------------------------------------------
// Main normalization: Ticketmaster event → Event
// ---------------------------------------------------------------------------

export function normalizeTMEvent(raw: TMEvent): Event {
  const venue = raw._embedded?.venues?.[0]
    ? mapTMVenue(raw._embedded.venues[0])
    : {
        id: "unknown",
        name: "Unknown Venue",
        neighborhood: "suburbs" as Neighborhood,
        address: "",
        capacity: "small" as VenueCapacity,
      }

  const attraction = raw._embedded?.attractions?.[0]
  const artistName = attraction?.name ?? raw.name

  const genres = mapTMGenre(raw.classifications)
  const mood = deriveMood(genres)

  const price = mapTMPrice(raw.priceRanges)
  const imageUrl = selectImage(raw.images)
  const ageRestriction = inferAgeRestriction(raw)

  const showTime = formatLocalTime(raw.dates.start.localTime)
  const doorsTime = raw.doorsTimes?.localTime
    ? formatLocalTime(raw.doorsTimes.localTime)
    : undefined

  // popularity: TM sends 0–1 float; scale to 1–100
  const rawPop = raw.popularity ?? 0.5
  const popularity = Math.round(Math.max(1, Math.min(100, rawPop * 100)))

  // Build a description from available fields
  const descriptionParts: string[] = []
  if (raw.info) descriptionParts.push(raw.info)
  if (raw.pleaseNote) descriptionParts.push(raw.pleaseNote)
  const description =
    descriptionParts.join(" ").slice(0, 500) ||
    `${artistName} live at ${venue.name} in ${venue.neighborhood.replace(/-/g, " ")}.`

  // Supporting acts: additional attractions beyond the headliner
  const supportingActs = (raw._embedded?.attractions ?? [])
    .slice(1)
    .map((a) => a.name)
    .filter(Boolean)

  return {
    id: raw.id,
    artist: artistName,
    venue,
    date: raw.dates.start.localDate,
    time: showTime,
    doors: doorsTime,
    price,
    ageRestriction,
    genres,
    mood,
    ticketUrl: raw.url,
    imageUrl,
    description,
    popularity,
    isLocalArtist: isLocalArtist(artistName),
    supportingActs: supportingActs.length > 0 ? supportingActs : undefined,
  }
}

// ---------------------------------------------------------------------------
// Main normalization: Bandsintown event → Event
// ---------------------------------------------------------------------------

export function normalizeBITEvent(raw: BITArtistEvent): Event {
  const lat = parseFloat(raw.venue.latitude ?? "0")
  const lon = parseFloat(raw.venue.longitude ?? "0")
  const neighborhood = mapLatLngToNeighborhood(lat, lon)

  const venue: Venue = {
    id: `bit-venue-${raw.venue.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: raw.venue.name,
    neighborhood,
    address: `${raw.venue.name}, ${raw.venue.city}, ${raw.venue.region}`,
    capacity: inferCapacity(raw.venue.name, raw.venue.city),
  }

  const artistName = raw.lineup?.[0] ?? "Unknown Artist"

  // Bandsintown doesn't provide genre data per event; default to rock
  const genres: Genre[] = ["rock"]
  const mood = deriveMood(genres)

  const ticketOffer = raw.offers?.find((o) => o.type === "Tickets") ?? raw.offers?.[0]
  const ticketUrl = ticketOffer?.url ?? raw.url

  // Parse datetime (ISO 8601 from BIT: "2024-05-10T20:00:00")
  const dtParts = raw.datetime.split("T")
  const date = dtParts[0] ?? raw.datetime
  const time = dtParts[1] ? formatLocalTime(dtParts[1].slice(0, 5)) : "TBA"

  const description =
    raw.description ||
    `${artistName} live at ${raw.venue.name} in ${raw.venue.city}.`

  const supportingActs = (raw.lineup ?? []).slice(1).filter(Boolean)

  return {
    id: `bit-${raw.id}`,
    artist: artistName,
    venue,
    date,
    time,
    price: "tbd",
    ageRestriction: "all-ages",
    genres,
    mood,
    ticketUrl,
    imageUrl: raw.artist?.image_url ?? "/placeholder-event.jpg",
    description,
    popularity: 50,
    isLocalArtist: isLocalArtist(artistName),
    supportingActs: supportingActs.length > 0 ? supportingActs : undefined,
  }
}

// ---------------------------------------------------------------------------
// Deduplication: remove BIT events that already exist in TM results
// ---------------------------------------------------------------------------

export function deduplicateEvents(
  tmEvents: Event[],
  bitEvents: Event[]
): Event[] {
  const seen = new Set<string>()

  for (const e of tmEvents) {
    // key: normalized artist name + date
    seen.add(`${e.artist.toLowerCase()}|${e.date}`)
  }

  const uniqueBIT = bitEvents.filter((e) => {
    const key = `${e.artist.toLowerCase()}|${e.date}`
    return !seen.has(key)
  })

  return [...tmEvents, ...uniqueBIT]
}
