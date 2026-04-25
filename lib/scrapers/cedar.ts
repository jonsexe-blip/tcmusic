/**
 * Cedar Cultural Centre scraper
 * Source: https://www.thecedar.org/events
 *
 * Cedar's own website uses a standard HTML event listing with div.event-item
 * containers. Previously scraped Eventbrite, but Eventbrite removed all
 * JSON-LD and structured data from their pages.
 *
 * Venue: 416 Cedar Ave S, Minneapolis (Cedar-Riverside / Seward)
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const BASE_URL = "https://www.thecedar.org"
const EVENTS_URL = `${BASE_URL}/events`

const CEDAR_VENUE: Venue = {
  id: "cedar-cultural-centre",
  name: "Cedar Cultural Centre",
  neighborhood: "seward",
  address: "416 Cedar Ave S, Minneapolis, MN 55454",
  capacity: "medium",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
}

function parseDate(text: string): string | null {
  // Handles "Apr 25", "April 25, 2026", "Friday, April 25"
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

function parseTime(text: string): string {
  const m = text.match(/(\d{1,2}:\d{2}\s*[AP]M)/i)
  if (!m) return "TBA"
  return m[1]!.replace(/\s*([AP]M)/i, " $1").trim()
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + "T00:00:00") >= today
}

// ---------------------------------------------------------------------------
// Fetch & parse
// ---------------------------------------------------------------------------

export async function scrapeCedar(): Promise<Event[]> {
  let html: string
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" },
    })
    if (!res.ok) throw new Error(`Cedar fetch failed: ${res.status}`)
    html = await res.text()
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const events: Event[] = []

  // div.event-item — one per event
  //   h3 > a[href="/events/slug"] — title + URL
  //   div.event-date              — "Apr 25" or "April 25"
  //   time                        — full date text fallback
  $("div.event-item, article.event-item, .event-item").each((_, el) => {
    try {
      const $el = $(el)

      // Title and URL
      const linkEl = $el.find("h3 a, h2 a, h4 a").first()
      const title = linkEl.text().trim()
      if (!title) return

      const href = linkEl.attr("href") ?? ""
      const ticketUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`

      // Date — try event-date div first, then <time> element, then full text
      const dateText = $el.find(".event-date, time").first().text().trim()
        || $el.text().trim()
      const date = parseDate(dateText)
      if (!date || !isUpcoming(date)) return

      // Time
      const time = parseTime($el.text())

      // Image
      const imgSrc = $el.find("img").first().attr("src") ?? ""
      const imageUrl = imgSrc
        ? (imgSrc.startsWith("http") ? imgSrc : `${BASE_URL}${imgSrc}`)
        : "/placeholder-event.jpg"

      events.push({
        id: `cedar-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
        artist: title,
        venue: CEDAR_VENUE,
        date,
        time,
        price: "tbd",
        ageRestriction: "all-ages",
        genres: ["world"],
        mood: genreMoodMap["world"] ?? "chill",
        ticketUrl,
        imageUrl,
        description: `${title} live at the Cedar Cultural Centre.`,
        popularity: 50,
        isLocalArtist: false,
      })
    } catch {
      // skip
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
