/**
 * Parkway Theater scraper
 * Source: https://theparkwaytheater.com/all-events-summary
 *
 * Squarespace eventlist markup: article.eventlist-event containers with
 * time.event-date[datetime] for dates, .eventlist-title-link for titles,
 * and .eventlist-cats for category filtering.
 *
 * Pure film screenings (category "Movies" without "Live Events") are skipped.
 * Hybrid events like silent film + live score are included.
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

  // Squarespace eventlist structure:
  //   article.eventlist-event           — one per event
  //   .eventlist-title-link             — event title text
  //   time.event-date[datetime]         — ISO date in datetime attr ("2026-04-14")
  //   time.event-time-12hr-start        — show time text ("7:30 PM")
  //   .eventlist-cats a                 — category tags
  //   a.eventlist-column-thumbnail img  — event image (data-src)

  $("article.eventlist-event").each((_, el) => {
    try {
      const $el = $(el)

      // Title and ticket URL — .eventlist-title-link is the <a> tag itself
      const titleEl = $el.find("a.eventlist-title-link").first()
      const title = titleEl.text().trim()
      if (!title) return
      const href = titleEl.attr("href") ?? ""
      const ticketUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`

      // Categories
      const cats = $el.find(".eventlist-cats a").map((_, a) => $(a).text().trim().toLowerCase()).get()

      // Skip pure film screenings — but keep "Live Events" that happen to also be tagged Movies
      const isMovie = cats.includes("movies") || cats.includes("film") || cats.includes("films")
      const isLive = cats.includes("live events") || cats.includes("live music") || cats.includes("comedy")
      if (isMovie && !isLive) return

      // Date from datetime attribute
      const dateAttr = $el.find("time.event-date").first().attr("datetime") ?? ""
      if (!dateAttr.match(/^\d{4}-\d{2}-\d{2}/)) return
      const date = dateAttr.slice(0, 10)
      if (!isUpcoming(date)) return

      // Time
      const time = $el.find("time.event-time-12hr-start").first().text().trim() || "TBA"

      // Image (Squarespace lazy-loads via data-src)
      const imgSrc = $el.find("a.eventlist-column-thumbnail img").first().attr("data-src") ?? ""
      const imageUrl = imgSrc || "/placeholder-event.jpg"

      // Description
      const description =
        $el.find(".eventlist-excerpt p").first().text().trim().slice(0, 300)
        || `${title} at the Parkway Theater.`

      const genre = cats.includes("comedy") ? "comedy" : "indie"

      events.push({
        id: `parkway-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
        artist: title,
        venue: PARKWAY_VENUE,
        date,
        time,
        price: "tbd",
        ageRestriction: "all-ages",
        genres: [genre],
        mood: genreMoodMap[genre],
        ticketUrl,
        imageUrl,
        description,
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
