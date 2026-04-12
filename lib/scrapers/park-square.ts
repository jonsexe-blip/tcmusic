/**
 * Park Square Theatre scraper
 * Source: https://www.parksquaretheatre.org/season-information-season-tickets (Squarespace)
 *
 * Strategy: heading-centric — walk all h2/h3 elements on the page, find date
 * range in nearby text, skip past shows (use closing date), include mid-run shows.
 * Squarespace uses .fe-block-* containers; we don't rely on specific class names.
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const VENUE: Venue = {
  id: "park-square-theatre",
  name: "Park Square Theatre",
  neighborhood: "st-paul-downtown",
  address: "20 W 7th Pl, Saint Paul, MN 55102",
  capacity: "medium",
}

const SEASON_URL = "https://www.parksquaretheatre.org/season-information-season-tickets"

// Salesforce ticket base — all Park Square shows link here
const TICKET_URL = "https://parksquaretheatre.my.salesforce-sites.com/ticket/"

function parseDateRange(raw: string): [string, string] | null {
  const years = [...raw.matchAll(/\d{4}/g)].map((m) => parseInt(m[0]))
  const closingYear = years.at(-1) ?? new Date().getFullYear()
  const openingYear = years[0] ?? closingYear

  const monthDayMatches = [...raw.matchAll(/([A-Za-z]+)\s+(\d{1,2})/g)]
  if (monthDayMatches.length < 2) return null

  const toDate = (match: RegExpMatchArray, year: number): string | null => {
    const monthIndex = new Date(`${match[1]} 1, 2000`).getMonth()
    if (isNaN(monthIndex)) return null
    const day = parseInt(match[2])
    return new Date(year, monthIndex, day).toISOString().split("T")[0]
  }

  const opening = toDate(monthDayMatches[0], openingYear)
  const closing = toDate(monthDayMatches.at(-1)!, closingYear)
  if (!opening || !closing) return null
  return [opening, closing]
}

// Words that indicate this heading is navigation/structural, not a show title
const SKIP_HEADINGS = /season|subscribe|about|contact|support|ticket|donate|our story|sponsor/i

export async function scrapeParkSquare(): Promise<Event[]> {
  try {
    const res = await fetch(SEASON_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const events: Event[] = []
    const today = new Date().toISOString().split("T")[0]
    const seen = new Set<string>()

    // Heading-centric: scan every h2/h3 as a potential show title
    $("h2, h3").each((_, heading) => {
      const titleEl = $(heading)
      const title = titleEl.text().trim()
      if (!title || title.length < 3 || title.length > 80) return
      if (SKIP_HEADINGS.test(title)) return
      if (seen.has(title.toLowerCase())) return

      // Walk up to find a meaningful container
      // Squarespace uses .fe-block-*, div, section — go up 3 levels at most
      let container = titleEl.parent()
      for (let i = 0; i < 3; i++) {
        if (container.find("p").length > 0) break
        container = container.parent()
      }

      const containerText = container.text()
      if (/cancel/i.test(containerText)) return

      // Find date range in paragraphs within the container
      let dateRange: [string, string] | null = null
      container.find("p, span").each((_, p) => {
        const text = $(p).text()
        if (/[A-Za-z]+ \d{1,2}.{0,30}\d{4}/.test(text) && !dateRange) {
          dateRange = parseDateRange(text)
        }
      })

      if (!dateRange) return
      const dr = dateRange as [string, string]
      const [opening, closing] = dr
      if (closing < today) return

      const eventDate = opening >= today ? opening : today
      seen.add(title.toLowerCase())

      const imgSrc = container.find("img[src]").first().attr("src") ?? "/placeholder-event.jpg"

      events.push({
        id: `park-square-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${opening}`,
        artist: title,
        venue: VENUE,
        date: eventDate,
        time: "TBA",
        price: "tbd",
        ageRestriction: "all-ages",
        genres: ["theater"],
        mood: genreMoodMap["theater"],
        ticketUrl: TICKET_URL,
        imageUrl: imgSrc,
        description: `${title} at Park Square Theatre.`,
        popularity: 55,
        isLocalArtist: true,
      })
    })

    return events
  } catch {
    return []
  }
}
