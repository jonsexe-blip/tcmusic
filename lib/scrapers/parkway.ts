/**
 * Parkway Theater scraper
 * Source: https://theparkwaytheater.com/all-events
 *
 * Squarespace-powered site with server-rendered event list. Each event is a
 * <div class="event-block"> with text-based date/time and category links.
 * No JS execution needed.
 *
 * Movie/film screenings are skipped — only live music and comedy events
 * are included. Images are left blank for Spotify enrichment.
 *
 * Venue: 4814 Chicago Ave, Minneapolis (South Minneapolis)
 */

import * as cheerio from "cheerio"
import type { Event, Genre, Venue } from "../types"
import { genreMoodMap } from "../types"

const EVENTS_URL = "https://theparkwaytheater.com/all-events"
const BASE_URL = "https://theparkwaytheater.com"

const PARKWAY_VENUE: Venue = {
  id: "parkway-theater",
  name: "Parkway Theater",
  neighborhood: "south-mpls",
  address: "4814 Chicago Ave, Minneapolis, MN 55417",
  capacity: "medium",
}

// Categories to skip (film screenings, private events, etc.)
const SKIP_CATEGORIES = new Set(["movies", "films", "film", "movie", "private"])

function parseFullDate(text: string): string | null {
  // Text format: "Friday, April 10, 2026"
  const match = text.match(/(\w+)\s+(\d+),\s+(\d{4})/)
  if (!match) return null
  const d = new Date(`${match[0]}`)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + "T00:00:00") >= today
}

function mapCategories(cats: string[]): Genre[] {
  const lower = cats.map((c) => c.toLowerCase())
  if (lower.some((c) => c.includes("comedy"))) return ["comedy"]
  // Everything else is a live music event
  return ["indie"]
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

  $("div.event-block").each((_, el) => {
    try {
      const title = $(el).find("h2 a").first().text().trim()
      if (!title) return

      // Categories — skip film/movie events
      const categories = $(el)
        .find("div.event-categories a")
        .map((_, a) => $(a).text().trim())
        .get()
      const catLower = categories.map((c) => c.toLowerCase())
      if (catLower.some((c) => SKIP_CATEGORIES.has(c))) return

      // Full date from first <li> in event-details: "Friday, April 10, 2026"
      const dateText = $(el).find("ul.event-details li").first().text().trim()
      const date = parseFullDate(dateText)
      if (!date || !isUpcoming(date)) return

      // Time from the .time span in the date block
      const time = $(el).find("div.event-date .time").text().trim() || "TBA"

      // Ticket/detail URL
      const slug = $(el).find("h2 a").attr("href") ?? ""
      const ticketUrl = slug.startsWith("http") ? slug : `${BASE_URL}${slug}`

      // Description from the paragraph
      const description =
        $(el).find("p").first().text().trim().slice(0, 300) ||
        `${title} at the Parkway Theater.`

      const genres = mapCategories(categories)
      const mood = genreMoodMap[genres[0]] ?? "chill"

      events.push({
        id: `parkway-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
        artist: title,
        venue: PARKWAY_VENUE,
        date,
        time,
        price: "tbd",
        ageRestriction: "all-ages",
        genres,
        mood,
        ticketUrl,
        imageUrl: "/placeholder-event.jpg",
        description,
        popularity: 50,
        isLocalArtist: false,
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
