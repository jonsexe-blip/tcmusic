/**
 * Bryant-Lake Bowl Theater scraper
 * Source: https://www.bryantlakebowl.com/theater
 *
 * Squarespace-powered site with server-rendered event list. Each event is an
 * <article class="eventlist-event"> with structured date/time attributes —
 * no JS execution needed.
 *
 * Venue: 810 W Lake St, Minneapolis (Uptown)
 * Genre: comedy (primary — also hosts music and variety shows)
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const EVENTS_URL = "https://www.bryantlakebowl.com/theater"
const BASE_URL = "https://www.bryantlakebowl.com"

const BLB_VENUE: Venue = {
  id: "bryant-lake-bowl",
  name: "Bryant Lake Bowl",
  neighborhood: "uptown",
  address: "810 W Lake St, Minneapolis, MN 55408",
  capacity: "small",
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + "T00:00:00") >= today
}

export async function scrapeBryantLakeBowl(): Promise<Event[]> {
  let html: string
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) throw new Error(`BLB fetch failed: ${res.status}`)
    html = await res.text()
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const events: Event[] = []

  $("article.eventlist-event").each((_, el) => {
    try {
      const title = $(el).find("a.eventlist-title-link").text().trim()
      if (!title) return

      // Date comes from datetime attribute: "YYYY-MM-DD"
      const date = $(el).find("time.event-date").attr("datetime")
      if (!date || !isUpcoming(date)) return

      // Start time already formatted "3:00 PM"
      const time = $(el).find("time.event-time-localized-start").text().trim() || "TBA"

      // Ticket/detail URL
      const slug = $(el).find("a.eventlist-title-link").attr("href") ?? ""
      const ticketUrl = slug.startsWith("http") ? slug : `${BASE_URL}${slug}`

      // Image
      const imgSrc = $(el).find("a.eventlist-column-thumbnail img").attr("src")
      const imageUrl = imgSrc ?? "/placeholder-event.jpg"

      // Description from the event body text (if any)
      const description =
        $(el).find(".eventlist-description").text().trim().slice(0, 300) ||
        `${title} at Bryant Lake Bowl.`

      events.push({
        id: `blb-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
        artist: title,
        venue: BLB_VENUE,
        date,
        time,
        price: "tbd",
        ageRestriction: "all-ages",
        genres: ["comedy"],
        mood: genreMoodMap["comedy"] ?? "chill",
        ticketUrl,
        imageUrl,
        description,
        popularity: 45,
        isLocalArtist: true,
      })
    } catch {
      // Skip malformed events
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
