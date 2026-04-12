/**
 * First Avenue family scraper
 * Covers: First Avenue, 7th Street Entry, Turf Club, Fine Line Music Cafe
 * Source: https://first-avenue.com/shows
 *
 * Server-rendered WordPress site — no JS execution needed.
 * Each show is a `.show_list_item` div. The page defaults to the current month;
 * we fetch two months to get a reasonable upcoming window.
 */

import * as cheerio from "cheerio"
import type { Event, Venue, Genre, Neighborhood, VenueCapacity } from "../types"
import { genreMoodMap } from "../types"
import { mapLatLngToNeighborhood } from "../api/normalize"

const BASE_URL = "https://first-avenue.com"

// ---------------------------------------------------------------------------
// Venue registry — First Avenue family venues
// ---------------------------------------------------------------------------

interface FAVenueConfig {
  id: string
  name: string
  neighborhood: Neighborhood
  address: string
  capacity: VenueCapacity
}

const FA_VENUES: Record<string, FAVenueConfig> = {
  "First Avenue": {
    id: "fa-first-avenue",
    name: "First Avenue",
    neighborhood: "downtown-mpls",
    address: "701 1st Ave N, Minneapolis, MN 55403",
    capacity: "large",
  },
  "7th St Entry": {
    id: "fa-7th-street-entry",
    name: "7th Street Entry",
    neighborhood: "downtown-mpls",
    address: "701 1st Ave N, Minneapolis, MN 55403",
    capacity: "small",
  },
  "Turf Club": {
    id: "fa-turf-club",
    name: "Turf Club",
    neighborhood: "midway",
    address: "1601 University Ave W, St Paul, MN 55104",
    capacity: "small",
  },
  "Fine Line": {
    id: "fa-fine-line",
    name: "Fine Line Music Cafe",
    neighborhood: "downtown-mpls",
    address: "318 1st Ave N, Minneapolis, MN 55401",
    capacity: "medium",
  },
  "Fitzgerald Theater": {
    id: "fa-fitzgerald",
    name: "Fitzgerald Theater",
    neighborhood: "st-paul-downtown",
    address: "10 E Exchange St, St Paul, MN 55101",
    capacity: "medium",
  },
}

function resolveVenue(venueName: string): FAVenueConfig {
  // Match on partial name (e.g. "7th Street Entry" vs "7th St Entry")
  const key = Object.keys(FA_VENUES).find((k) =>
    venueName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(venueName.toLowerCase().trim())
  )
  return key
    ? FA_VENUES[key]
    : {
        id: `fa-${venueName.toLowerCase().replace(/\s+/g, "-")}`,
        name: venueName,
        neighborhood: "downtown-mpls",
        address: "Minneapolis, MN",
        capacity: "medium",
      }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
}

function buildDate(month: string, day: string): string {
  const m = MONTHS[month.trim().toLowerCase().slice(0, 3)] ?? "01"
  const d = day.trim().padStart(2, "0")
  // Infer year: if month is before current month, it's next year
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const eventMonth = parseInt(m, 10)
  const year = eventMonth < currentMonth ? currentYear + 1 : currentYear
  return `${year}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// Supporting acts parser
// ---------------------------------------------------------------------------

function parseSupportingActs(h5Html: string): string[] {
  // "with X, Y and Z" → ["X", "Y", "Z"]
  return h5Html
    .replace(/<[^>]+>/g, " ")           // strip tags
    .replace(/&nbsp;/g, " ")
    .replace(/^\s*(with|feat\.?)\s*/i, "") // strip leading "with"
    .split(/\s+and\s+|\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Event page fetch — extracts "Show Starts" time from the detail page
// ---------------------------------------------------------------------------

async function fetchShowTime(eventUrl: string): Promise<string> {
  try {
    const res = await fetch(eventUrl, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) return "TBA"
    const html = await res.text()
    const $ = cheerio.load(html)

    // Find the "Show Starts" label then grab its sibling h2
    let showTime = "TBA"
    $("h6").each((_, el) => {
      const label = $(el).text().trim().toLowerCase()
      if (label.includes("show starts") || label.includes("showtime")) {
        const time = $(el).next("h2").text().trim()
        if (time) showTime = formatFATime(time)
      }
    })
    // Fall back to Doors Open if no show time found
    if (showTime === "TBA") {
      $("h6").each((_, el) => {
        const label = $(el).text().trim().toLowerCase()
        if (label.includes("doors")) {
          const time = $(el).next("h2").text().trim()
          if (time) showTime = formatFATime(time)
        }
      })
    }
    return showTime
  } catch {
    return "TBA"
  }
}

function formatFATime(raw: string): string {
  // "7PM" → "7:00 PM", "8:30PM" → "8:30 PM"
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return raw
  const h = match[1]
  const m = match[2] ?? "00"
  const period = match[3].toUpperCase()
  return `${h}:${m} ${period}`
}

// ---------------------------------------------------------------------------
// Page fetch
// ---------------------------------------------------------------------------

async function fetchPage(startDate?: string): Promise<string> {
  const url = startDate
    ? `${BASE_URL}/shows?post_type=event&start_date=${startDate}`
    : `${BASE_URL}/shows`

  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
  })

  if (!res.ok) throw new Error(`First Avenue fetch failed: ${res.status}`)
  return res.text()
}

// ---------------------------------------------------------------------------
// Parse a single HTML page into Events
// ---------------------------------------------------------------------------

function parsePage(html: string): Event[] {
  const $ = cheerio.load(html)
  const events: Event[] = []

  $(".show_list_item").each((_, el) => {
    try {
      const $el = $(el)

      // Date — month and day are in separate divs
      const month = $el.find(".date .month").first().text().trim()
      const day   = $el.find(".date .day").first().text().trim()
      if (!month || !day) return

      const date = buildDate(month, day)

      // Venue
      const venueName = $el.find(".venue_name").first().text().trim()
      const venueConfig = resolveVenue(venueName || "First Avenue")
      const venue: Venue = { ...venueConfig }

      // Artist
      const artistEl = $el.find(".show_name h4 a").first()
      const artist = artistEl.text().trim()
      if (!artist) return

      // Event URL / ticket URL
      const eventUrl = artistEl.attr("href") ?? $el.find(".gig_poster_container").attr("href") ?? ""
      const ticketHref = $el.find(".btn-row a").first().attr("href") ?? eventUrl

      // Image
      const photoStyle = $el.find(".photo").first().attr("style") ?? ""
      const imgMatch = photoStyle.match(/url\(([^)]+)\)/)
      const imageUrl = imgMatch ? imgMatch[1].replace(/['"]/g, "") : "/placeholder-event.jpg"

      // Local artist flag — FA marks local shows with ★
      const h6Text = $el.find(".show_name h6").text()
      const isLocalArtist = h6Text.includes("★") || h6Text.toLowerCase().includes("local")

      // Supporting acts
      const h5El = $el.find(".show_name h5")
      const supportingActs = h5El.length
        ? parseSupportingActs(h5El.html() ?? "")
        : undefined

      // Description from subtitle
      const subtitle = h6Text
        .replace(/★[^★]*★/g, "")
        .replace(/\s+/g, " ")
        .trim()

      // Genre defaults — FA is primarily indie/rock; local shows skew indie
      const genres: Genre[] = isLocalArtist ? ["indie"] : ["rock"]
      const mood = genreMoodMap[genres[0]]

      events.push({
        id: `fa-${$el.attr("id") ?? artist.toLowerCase().replace(/\s+/g, "-")}-${date}`,
        artist,
        venue,
        date,
        time: "TBA",
        price: "tbd",
        ageRestriction: "all-ages",
        genres,
        mood,
        ticketUrl: ticketHref || eventUrl,
        imageUrl,
        description: subtitle || `${artist} live at ${venue.name}.`,
        popularity: isLocalArtist ? 25 : 50,
        isLocalArtist,
        supportingActs: supportingActs?.length ? supportingActs : undefined,
      })
    } catch {
      // Skip malformed show entries
    }
  })

  return events
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export async function scrapeFirstAvenue(): Promise<Event[]> {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}01`
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonth = `${nextMonthDate.getFullYear()}${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}01`

  const [page1, page2] = await Promise.allSettled([
    fetchPage(thisMonth),
    fetchPage(nextMonth),
  ])

  const events: Event[] = []
  if (page1.status === "fulfilled") events.push(...parsePage(page1.value))
  if (page2.status === "fulfilled") events.push(...parsePage(page2.value))

  // Deduplicate by id
  const seen = new Set<string>()
  const unique = events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  // Second pass — fetch show times from individual event pages in parallel
  const enriched = await Promise.all(
    unique.map(async (event) => {
      if (!event.ticketUrl || !event.ticketUrl.includes("first-avenue.com/event/")) {
        return event
      }
      const time = await fetchShowTime(event.ticketUrl)
      return time !== "TBA" ? { ...event, time } : event
    })
  )

  return enriched
}
