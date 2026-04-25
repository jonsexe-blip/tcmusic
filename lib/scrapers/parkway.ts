/**
 * Parkway Theater scraper
 * Source: https://theparkwaytheater.com/all-events-summary
 *
 * Squarespace summary-block layout. Each event is a:
 *   div.summary-item.summary-item-record-type-event
 *     a.summary-thumbnail-container[data-title, href]  — title + URL
 *     span.summary-thumbnail-event-date-month          — "Apr"
 *     span.summary-thumbnail-event-date-day            — "25"
 *     img                                              — event image
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

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + "T00:00:00") >= today
}

export async function scrapeParkway(): Promise<Event[]> {
  let html: string
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" },
    })
    if (!res.ok) throw new Error(`Parkway fetch failed: ${res.status}`)
    html = await res.text()
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const events: Event[] = []

  $(".summary-item-record-type-event").each((_, el) => {
    try {
      const $el = $(el)
      const linkEl = $el.find("a.summary-thumbnail-container").first()

      // Title is in data-title attribute — link text contains only date/image
      const title = (linkEl.attr("data-title") ?? "").trim()
      if (!title || title.length < 2) return

      // Skip pure film screenings by title heuristic
      // (Parkway doesn't expose categories in the summary view)
      if (/\b(35mm|16mm)\b/i.test(title) && !/\blive\b|\bconcert\b|\bband\b/i.test(title)) return

      // Date from month + day spans
      const monthText = $el.find(".summary-thumbnail-event-date-month").first().text().trim().toLowerCase().slice(0, 3)
      const dayText = $el.find(".summary-thumbnail-event-date-day").first().text().trim()
      const month = MONTH_MAP[monthText]
      if (!month || !dayText) return

      const now = new Date()
      const eventMonth = parseInt(month, 10)
      const year = eventMonth < now.getMonth() + 1
        ? now.getFullYear() + 1
        : now.getFullYear()
      const date = `${year}-${month}-${dayText.padStart(2, "0")}`
      if (!isUpcoming(date)) return

      // URL
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

  const seen = new Set<string>()
  return events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}
