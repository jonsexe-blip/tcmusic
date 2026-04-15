/**
 * Parkway Theater scraper
 * Source: https://theparkwaytheater.com/all-events-summary
 *
 * Squarespace-powered site. The /all-events URL is now a 404; events are
 * served from /all-events-summary. The page uses Squarespace's standard
 * eventlist markup: article.eventlist-event elements with <time datetime="…">
 * for dates and .eventlist-title for event names.
 *
 * Movie/film screenings are skipped — only live music and comedy events
 * are included.
 *
 * Venue: 4814 Chicago Ave, Minneapolis (South Minneapolis)
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const EVENTS_URL = "https://theparkwaytheater.com/all-events-summary"
const BASE_URL = "https://theparkwaytheater.com"

const PARKWAY_VENUE: Venue = {
  id: "parkway-theater",
  name: "Parkway Theater",
  neighborhood: "south-mpls",
  address: "4814 Chicago Ave, Minneapolis, MN 55417",
  capacity: "medium",
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + "T00:00:00") >= today
}

/** Parse a short date string like "Apr 14" or "April 14, 2026" into YYYY-MM-DD */
const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
}

function parseShortDate(text: string): string | null {
  const m = text.match(/([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/)
  if (!m) return null
  const month = MONTH_MAP[m[1]!.toLowerCase().slice(0, 3)]
  if (!month) return null
  const day = m[2]!.padStart(2, "0")
  const now = new Date()
  const eventMonth = parseInt(month, 10)
  const year = m[3]
    ? m[3]
    : eventMonth < now.getMonth() + 1
      ? String(now.getFullYear() + 1)
      : String(now.getFullYear())
  return `${year}-${month}-${day}`
}


export async function scrapeParkway(): Promise<Event[]> {
  let html: string
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) throw new Error(`Parkway fetch failed: ${res.status}`)
    html = await res.text()
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const events: Event[] = []

  // The /all-events-summary page uses Squarespace's summary thumbnail template:
  //   .summary-thumbnail-outer-container  — one per event
  //   a.summary-thumbnail-container       — the link, carries data-title and href
  //   .summary-thumbnail-event-date-month — "Apr"
  //   .summary-thumbnail-event-date-day   — "14"
  //   .summary-thumbnail-image            — event image

  $(".summary-thumbnail-outer-container").each((_, el) => {
    try {
      const $el = $(el)
      const linkEl = $el.find("a.summary-thumbnail-container").first()

      // Title lives in data-title, not link text
      const title = (linkEl.attr("data-title") ?? "").trim()
      if (!title || title.length < 2) return

      // Skip film screenings
      if (/\bfilm\b|\bmovie\b|\bscreening\b|\b35mm\b/i.test(title)) return

      // Date from month + day spans
      const month = $el.find(".summary-thumbnail-event-date-month").first().text().trim()
      const day = $el.find(".summary-thumbnail-event-date-day").first().text().trim()
      const date = parseShortDate(`${month} ${day}`)
      if (!date || !isUpcoming(date)) return

      // Ticket URL
      const href = linkEl.attr("href") ?? ""
      const ticketUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`

      // Image
      const imgSrc = $el.find("img").first().attr("data-src") ?? $el.find("img").first().attr("src") ?? ""
      const imageUrl = imgSrc || "/placeholder-event.jpg"

      events.push({
        id: `parkway-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
        artist: title,
        venue: PARKWAY_VENUE,
        date,
        time: "TBA",
        price: "tbd",
        ageRestriction: "all-ages",
        genres: ["indie"],
        mood: genreMoodMap["indie"],
        ticketUrl,
        imageUrl,
        description: `${title} at the Parkway Theater.`,
        popularity: 50,
        isLocalArtist: false,
      })
    } catch {
      // skip
    }
  })

  // Deduplicate by id
  const deduped = new Set<string>()
  return events.filter((e) => {
    if (deduped.has(e.id)) return false
    deduped.add(e.id)
    return true
  })
}
