/**
 * First Avenue family scraper
 * Covers: First Avenue, 7th Street Entry, Turf Club, Fine Line Music Cafe
 * Source: https://first-avenue.com/shows
 *
 * FA redesigned their site (2026): events are now in <article> elements with
 * venue-* CSS classes instead of the old .show_list_item / .photo pattern.
 * Images come from JSON-LD (WebPage schema) on individual event pages.
 * Falls back to the old .show_list_item selectors if the new structure isn't found.
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
  "Palace Theatre": {
    id: "fa-palace-theatre",
    name: "Palace Theatre",
    neighborhood: "st-paul-downtown",
    address: "17 W 7th Place, Saint Paul, MN 55102",
    capacity: "large",
  },
}

// Maps the CSS class suffix (e.g. "first-avenue") to a venue config key
const VENUE_CLASS_MAP: Record<string, string> = {
  "first-avenue": "First Avenue",
  "7th-st-entry": "7th St Entry",
  "7th-street-entry": "7th St Entry",
  "turf-club": "Turf Club",
  "fine-line": "Fine Line",
  "fitzgerald-theater": "Fitzgerald Theater",
  "palace-theatre": "Palace Theatre",
}

function resolveVenueFromClass(classAttr: string): FAVenueConfig {
  for (const [cls, key] of Object.entries(VENUE_CLASS_MAP)) {
    if (classAttr.includes(`venue-${cls}`)) {
      return FA_VENUES[key] ?? FA_VENUES["First Avenue"]!
    }
  }
  return FA_VENUES["First Avenue"]!
}

function resolveVenueFromName(venueName: string): FAVenueConfig {
  const key = Object.keys(FA_VENUES).find((k) =>
    venueName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(venueName.toLowerCase().trim())
  )
  return key
    ? FA_VENUES[key]!
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

function buildDate(month: string, day: string, year?: string): string {
  const m = MONTHS[month.trim().toLowerCase().slice(0, 3)] ?? "01"
  const d = day.trim().padStart(2, "0")
  if (year) return `${year}-${m}-${d}`
  // Infer year: if month is before current month, it's next year
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const eventMonth = parseInt(m, 10)
  const y = eventMonth < currentMonth ? currentYear + 1 : currentYear
  return `${y}-${m}-${d}`
}

/** Extract a conservative placeholder date from an FA event URL like /event/2026-04-ber/ */
function dateFromEventUrl(eventUrl: string): string {
  const match = eventUrl.match(/\/event\/(\d{4})-(\d{2})-/)
  if (!match) return "2099-12-31"
  const [, year, month] = match
  // Use last day of the month so near-future events pass the isUpcoming filter
  const lastDay = new Date(parseInt(year!), parseInt(month!), 0).getDate()
  return `${year}-${month}-${lastDay.toString().padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Supporting acts parser
// ---------------------------------------------------------------------------

function parseSupportingActs(raw: string): string[] {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/^\s*(with|feat\.?)\s*/i, "")
    .split(/\s+and\s+|\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Show details fetch — extracts time, image, and full date from event page
// ---------------------------------------------------------------------------

interface ShowDetails {
  time: string
  imageUrl: string | null
  date: string | null
}

async function fetchShowDetails(eventUrl: string): Promise<ShowDetails> {
  const DEFAULT: ShowDetails = { time: "TBA", imageUrl: null, date: null }
  try {
    const res = await fetch(eventUrl, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) return DEFAULT
    const html = await res.text()
    const $ = cheerio.load(html)

    // --- Image from JSON-LD (WebPage schema has image.url) ---
    let imageUrl: string | null = null
    $('script[type="application/ld+json"]').each((_, el) => {
      if (imageUrl) return
      try {
        const data = JSON.parse($(el).html() ?? "")
        // FA uses WebPage schema with image object
        if (data["@type"] === "WebPage" && data.image?.url) {
          imageUrl = data.image.url as string
        }
        // Some pages may use Event schema directly
        if (data["@type"] === "Event") {
          if (typeof data.image === "string") imageUrl = data.image
          else if (data.image?.url) imageUrl = data.image.url as string
        }
      } catch {
        // skip malformed JSON
      }
    })

    // Fallback: first <img> that isn't an SVG icon
    if (!imageUrl) {
      $("img").each((_, el) => {
        if (imageUrl) return
        const src = $(el).attr("src") ?? ""
        if (src && !src.includes(".svg") && (src.includes("wp-content") || src.includes("i0.wp.com"))) {
          imageUrl = src.startsWith("http") ? src : `${BASE_URL}${src}`
        }
      })
    }

    // --- Full date from description text or body ---
    let date: string | null = null
    const fullText = $("body").text()
    // Match "April 17, 2026", "Apr 17th 2026", "April 17th, 2026", etc.
    const dateMatch = fullText.match(
      /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i
    )
    if (dateMatch) {
      date = buildDate(dateMatch[1]!, dateMatch[2]!, dateMatch[3]!)
    }

    // --- Show time from h6 → h2 pattern ---
    let time = "TBA"
    $("h6").each((_, el) => {
      const label = $(el).text().trim().toLowerCase()
      if (label.includes("show starts") || label.includes("showtime")) {
        const t = $(el).next("h2").text().trim()
        if (t) time = formatFATime(t)
      }
    })
    if (time === "TBA") {
      $("h6").each((_, el) => {
        const label = $(el).text().trim().toLowerCase()
        if (label.includes("doors")) {
          const t = $(el).next("h2").text().trim()
          if (t) time = formatFATime(t)
        }
      })
    }

    return { time, imageUrl, date }
  } catch {
    return DEFAULT
  }
}

function formatFATime(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return raw
  const h = match[1]!
  const m = match[2] ?? "00"
  const period = match[3]!.toUpperCase()
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
// Parse listing page — new <article>-based structure
// ---------------------------------------------------------------------------

function parsePageNew(html: string): Event[] {
  const $ = cheerio.load(html)
  const events: Event[] = []

  // New site: each event is an <article> containing a link to /event/
  const articles = $("article").filter((_, el) =>
    $(el).find("a[href*='/event/']").length > 0
  )

  articles.each((_, el) => {
    try {
      const $el = $(el)

      // Artist name from h4 or h3 link, stripping "★ Venue Name" suffix
      const titleLink = $el.find("h4 a, h3 a").first()
      let artist = titleLink.text().trim()
      // Strip "★ Venue Name" or trailing venue marker (e.g. "Ber ★ First Avenue")
      artist = artist.replace(/\s*★.*$/, "").trim()
      if (!artist) return

      // Event URL
      const hrefRaw = titleLink.attr("href") ?? $el.find("a[href*='/event/']").first().attr("href") ?? ""
      if (!hrefRaw) return
      const eventUrl = hrefRaw.startsWith("http") ? hrefRaw : `${BASE_URL}${hrefRaw}`
      if (!eventUrl.includes("/event/")) return

      // Venue from article's class attribute (e.g. "venue-first-avenue")
      const classAttr = $el.attr("class") ?? ""
      const venueConfig = resolveVenueFromClass(classAttr)
      const venue: Venue = { ...venueConfig }

      // Placeholder date from URL — second pass will update to actual date
      const date = dateFromEventUrl(eventUrl)

      // Ticket link (external AXS/TM, or fall back to event URL)
      const ticketLink =
        $el.find("a[href*='axs.com'], a[href*='ticketmaster.com'], a[href*='etix.com']").first().attr("href")
        ?? $el.find("a:contains('Buy Tickets')").first().attr("href")
        ?? eventUrl

      // Local artist marker (★ in title or h6 content)
      const rawTitle = titleLink.text().trim()
      const h6Text = $el.find("h6").text()
      const isLocalArtist = (h6Text.includes("★") && h6Text.toLowerCase().includes("local"))
        || rawTitle.startsWith("★")

      // Supporting acts from "with X" text within article
      const articleText = $el.text()
      const withMatch = articleText.match(/\bwith\s+([^\n\r]{3,80})/i)
      const supportingActs = withMatch
        ? parseSupportingActs(withMatch[1]!)
        : undefined

      const genres: Genre[] = isLocalArtist ? ["indie"] : ["rock"]
      const mood = genreMoodMap[genres[0]!]!

      const description = h6Text.replace(/★[^★]*★/g, "").replace(/\s+/g, " ").trim()
        || `${artist} live at ${venue.name}.`

      events.push({
        id: `fa-${hrefRaw.replace(/^\/event\//, "").replace(/\/$/, "")}`,
        artist,
        venue,
        date,
        time: "TBA",
        price: "tbd",
        ageRestriction: "all-ages",
        genres,
        mood,
        ticketUrl: ticketLink,
        imageUrl: "/placeholder-event.jpg",
        description: description.slice(0, 300),
        popularity: isLocalArtist ? 25 : 50,
        isLocalArtist,
        supportingActs: supportingActs?.length ? supportingActs : undefined,
      })
    } catch {
      // skip malformed entries
    }
  })

  return events
}

// ---------------------------------------------------------------------------
// Parse listing page — legacy .show_list_item structure (fallback)
// ---------------------------------------------------------------------------

function parsePageLegacy(html: string): Event[] {
  const $ = cheerio.load(html)
  const events: Event[] = []

  $(".show_list_item").each((_, el) => {
    try {
      const $el = $(el)

      const month = $el.find(".date .month").first().text().trim()
      const day = $el.find(".date .day").first().text().trim()
      if (!month || !day) return
      const date = buildDate(month, day)

      const venueName = $el.find(".venue_name").first().text().trim()
      const venueConfig = resolveVenueFromName(venueName || "First Avenue")
      const venue: Venue = { ...venueConfig }

      const artistEl = $el.find(".show_name h4 a").first()
      const artist = artistEl.text().trim()
      if (!artist) return

      const eventUrl = artistEl.attr("href") ?? $el.find(".gig_poster_container").attr("href") ?? ""
      const ticketHref = $el.find(".btn-row a").first().attr("href") ?? eventUrl

      const photoStyle = $el.find(".photo").first().attr("style") ?? ""
      const imgMatch = photoStyle.match(/url\(([^)]+)\)/)
      const imageUrl = imgMatch ? imgMatch[1]!.replace(/['"]/g, "") : "/placeholder-event.jpg"

      const h6Text = $el.find(".show_name h6").text()
      const isLocalArtist = h6Text.includes("★") || h6Text.toLowerCase().includes("local")

      const h5El = $el.find(".show_name h5")
      const supportingActs = h5El.length ? parseSupportingActs(h5El.html() ?? "") : undefined

      const subtitle = h6Text.replace(/★[^★]*★/g, "").replace(/\s+/g, " ").trim()

      const genres: Genre[] = isLocalArtist ? ["indie"] : ["rock"]
      const mood = genreMoodMap[genres[0]!]!

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
      // skip malformed show entries
    }
  })

  return events
}

function parsePage(html: string): Event[] {
  const newEvents = parsePageNew(html)
  if (newEvents.length > 0) return newEvents
  return parsePageLegacy(html)
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export async function scrapeFirstAvenue(): Promise<Event[]> {
  const now = new Date()
  const monthPages = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}01`
  })

  const pageResults = await Promise.allSettled(monthPages.map(fetchPage))

  const events: Event[] = []
  for (const result of pageResults) {
    if (result.status === "fulfilled") events.push(...parsePage(result.value))
  }

  // Deduplicate by id
  const seen = new Set<string>()
  const unique = events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  // Second pass — fetch show details (time + image + full date) from individual event pages
  const enriched = await Promise.all(
    unique.map(async (event) => {
      const isFAEventUrl = event.ticketUrl.includes("first-avenue.com/event/")
        || event.id.startsWith("fa-20")  // new-style IDs start with fa-YYYY-MM-slug
      if (!isFAEventUrl) return event

      const detailUrl = event.id.startsWith("fa-20")
        ? `${BASE_URL}/event/${event.id.replace(/^fa-/, "")}/`
        : event.ticketUrl

      const { time, imageUrl, date } = await fetchShowDetails(detailUrl)
      const updates: Partial<Event> = {}
      if (time !== "TBA") updates.time = time
      if (imageUrl) updates.imageUrl = imageUrl
      if (date) updates.date = date
      return Object.keys(updates).length > 0 ? { ...event, ...updates } : event
    })
  )

  return enriched
}
