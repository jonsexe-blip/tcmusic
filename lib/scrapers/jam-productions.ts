/**
 * Jam Productions scraper
 * Source: https://www.jamusa.com/events/category/minnesota
 *
 * Jam Productions is a concert promoter that books shows primarily at Palace
 * Theatre (St. Paul) and other Twin Cities venues. Events use the AXS ticketing
 * platform with a custom jamusa.com frontend.
 *
 * Structure: date header text + div.event-item or li containers beneath each date.
 */

import * as cheerio from "cheerio"
import type { Event, Venue, Neighborhood, VenueCapacity } from "../types"
import { genreMoodMap } from "../types"

const BASE_URL = "https://www.jamusa.com"
const EVENTS_URL = `${BASE_URL}/events/category/minnesota`

// ---------------------------------------------------------------------------
// Known MN venues managed/used by Jam Productions
// ---------------------------------------------------------------------------

interface JamVenueConfig {
  id: string
  name: string
  neighborhood: Neighborhood
  address: string
  capacity: VenueCapacity
}

const JAM_VENUES: Record<string, JamVenueConfig> = {
  "palace theatre": {
    id: "jam-palace-theatre",
    name: "Palace Theatre",
    neighborhood: "st-paul-downtown",
    address: "17 W 7th Place, Saint Paul, MN 55102",
    capacity: "large",
  },
  "state theatre": {
    id: "hennepin-state-theatre",
    name: "State Theatre",
    neighborhood: "downtown-mpls",
    address: "805 Hennepin Ave, Minneapolis, MN 55402",
    capacity: "large",
  },
  "orpheum theatre": {
    id: "hennepin-orpheum",
    name: "Orpheum Theatre",
    neighborhood: "downtown-mpls",
    address: "910 Hennepin Ave, Minneapolis, MN 55403",
    capacity: "large",
  },
  "pantages theatre": {
    id: "hennepin-pantages",
    name: "Pantages Theatre",
    neighborhood: "downtown-mpls",
    address: "710 Hennepin Ave, Minneapolis, MN 55403",
    capacity: "medium",
  },
  "myth": {
    id: "jam-myth",
    name: "The Myth",
    neighborhood: "suburbs",
    address: "3090 Southlawn Dr, Maplewood, MN 55109",
    capacity: "large",
  },
}

function resolveVenue(venueName: string): JamVenueConfig {
  const lower = venueName.toLowerCase()
  for (const [key, cfg] of Object.entries(JAM_VENUES)) {
    if (lower.includes(key)) return cfg
  }
  // Generic fallback — try to infer neighborhood from city name
  const neighborhood: Neighborhood = lower.includes("st. paul") || lower.includes("saint paul")
    ? "st-paul-downtown"
    : "downtown-mpls"
  return {
    id: `jam-venue-${venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: venueName,
    neighborhood,
    address: `${venueName}, Minneapolis–Saint Paul, MN`,
    capacity: "large",
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
}

function parseEventDate(text: string): string | null {
  // Handles "Apr 14 Tue", "October 9 Fri", "Apr 14", etc.
  const m = text.match(/([A-Za-z]+)\.?\s+(\d{1,2})/)
  if (!m) return null
  const month = MONTH_MAP[m[1]!.toLowerCase().slice(0, 3)]
  if (!month) return null
  const day = m[2]!.padStart(2, "0")
  const now = new Date()
  const eventMonth = parseInt(month, 10)
  const year = eventMonth < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear()
  return `${year}-${month}-${day}`
}

function parseShowTime(text: string): string {
  // "Doors: 7:00 PM / Show: 8:00 PM" → "8:00 PM"
  const showMatch = text.match(/[Ss]how(?:s|time)?[:\s]+(\d{1,2}:\d{2}\s*[AP]M)/i)
  if (showMatch) return showMatch[1]!.replace(/\s+/, " ").trim()
  // "Doors: 7:00 PM" → "7:00 PM"
  const doorsMatch = text.match(/[Dd]oors[:\s]+(\d{1,2}:\d{2}\s*[AP]M)/i)
  if (doorsMatch) return doorsMatch[1]!.replace(/\s+/, " ").trim()
  return "TBA"
}

function parseAgeRestriction(text: string): Event["ageRestriction"] {
  if (/21\s*[&+]?\s*[Oo]ver|21\+/.test(text)) return "21+"
  if (/18\s*[&+]?\s*[Oo]ver|18\+/.test(text)) return "18+"
  return "all-ages"
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + "T00:00:00") >= today
}

// ---------------------------------------------------------------------------
// Fetch & parse
// ---------------------------------------------------------------------------

export async function scrapeJamProductions(): Promise<Event[]> {
  let html: string
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const events: Event[] = []

  // Look for event items — try multiple selector patterns
  const eventEls = $("div.event-item, li:has(h3 a), li:has(img[src])").filter((_, el) => {
    return $(el).find("a[href*='/events/']").length > 0 || $(el).find("h3").length > 0
  })

  if (eventEls.length === 0) {
    // No events currently listed (common for MN category page off-season)
    return []
  }

  eventEls.each((_, el) => {
    try {
      const $el = $(el)

      // Artist from h3 or h2
      const titleEl = $el.find("h3 a, h2 a, h3, h2").first()
      const artist = titleEl.text().trim()
      if (!artist || artist.length < 2) return

      // Event URL
      const hrefRaw = titleEl.is("a")
        ? (titleEl.attr("href") ?? "")
        : ($el.find("a[href*='/events/']").first().attr("href") ?? "")
      const ticketUrl = hrefRaw
        ? (hrefRaw.startsWith("http") ? hrefRaw : `${BASE_URL}${hrefRaw}`)
        : EVENTS_URL

      // Date: scan up to 3 preceding siblings for a date-like text string
      let date: string | null = null
      let prev = $el.prev()
      for (let i = 0; i < 3 && prev.length && !date; i++) {
        const txt = prev.text().trim()
        if (txt.length < 25) date = parseEventDate(txt)
        prev = prev.prev()
      }
      if (!date || !isUpcoming(date)) return

      // Image
      const imgSrc = $el.find("img").first().attr("src") ?? ""
      const imageUrl = imgSrc && !imgSrc.includes(".svg")
        ? (imgSrc.startsWith("http") ? imgSrc : `${BASE_URL}${imgSrc}`)
        : "/placeholder-event.jpg"

      // Venue from <p> text (paragraphs that don't look like times/ages)
      const paragraphs = $el.find("p").map((_, p) => $(p).text().trim()).get()
      const venueParagraph = paragraphs.find((p) =>
        !p.match(/^\d|doors|show|pm|am|\d+\s*&/i) && p.length > 3
      ) ?? ""
      const venue: Venue = { ...resolveVenue(venueParagraph || "Palace Theatre") }

      // Time from doors/show line
      const timeLine = paragraphs.find((p) => /doors|show/i.test(p)) ?? ""
      const time = parseShowTime(timeLine)

      // Age restriction
      const ageText = paragraphs.join(" ")
      const ageRestriction = parseAgeRestriction(ageText)

      events.push({
        id: `jam-${artist.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
        artist,
        venue,
        date,
        time,
        price: "tbd",
        ageRestriction,
        genres: ["rock"],
        mood: genreMoodMap["rock"],
        ticketUrl,
        imageUrl,
        description: `${artist} live at ${venue.name}.`,
        popularity: 50,
        isLocalArtist: false,
      })
    } catch {
      // skip malformed entries
    }
  })

  // Deduplicate by id
  const seen = new Set<string>()
  return events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}
