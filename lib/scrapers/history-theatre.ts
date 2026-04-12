/**
 * History Theatre scraper
 * Source: https://www.historytheatre.com/2025-26-season (Drupal CMS)
 *
 * Strategy: heading-centric — walk all h3/h4 elements, find date range in
 * sibling/parent text, use closing date to include mid-run shows.
 *
 * Observed structure (from live page):
 *   <h4><a href="/2025-2026/show-slug">Show Title</a></h4>
 *   <p>dates paragraph</p>
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const VENUE: Venue = {
  id: "history-theatre",
  name: "History Theatre",
  neighborhood: "st-paul-downtown",
  address: "30 E 10th St, Saint Paul, MN 55101",
  capacity: "medium",
}

function seasonUrl(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startYear = month >= 6 ? year : year - 1
  const endYear = startYear + 1
  return `https://www.historytheatre.com/${startYear}-${String(endYear).slice(-2)}-season`
}

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

const SKIP_HEADINGS = /season|subscribe|about|contact|support|ticket|donate|sponsor|group|flex/i

export async function scrapeHistoryTheatre(): Promise<Event[]> {
  const url = seasonUrl()
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const events: Event[] = []
    const today = new Date().toISOString().split("T")[0]
    const seen = new Set<string>()

    // Heading-centric: walk h3 and h4 elements
    $("h3, h4").each((_, heading) => {
      const titleEl = $(heading)
      const title = titleEl.text().trim()
      if (!title || title.length < 3 || title.length > 100) return
      if (SKIP_HEADINGS.test(title)) return
      if (seen.has(title.toLowerCase())) return

      // Check heading text and nearby context for cancel
      const parent = titleEl.parent()
      if (/cancel/i.test(parent.text())) return

      // Look for date range — check next siblings, then parent's children
      let dateRange: [string, string] | null = null

      // Check following siblings (p, div, span)
      let sibling = titleEl.next()
      for (let i = 0; i < 5 && sibling.length; i++) {
        const text = sibling.text()
        if (/[A-Za-z]+ \d{1,2}.{0,30}\d{4}/.test(text) && !dateRange) {
          dateRange = parseDateRange(text)
        }
        sibling = sibling.next()
      }

      // Fallback: search within parent block
      if (!dateRange) {
        parent.find("p, span, strong").each((_, p) => {
          const text = $(p).text()
          if (/[A-Za-z]+ \d{1,2}.{0,30}\d{4}/.test(text) && !dateRange) {
            dateRange = parseDateRange(text)
          }
        })
      }

      // Walk up one level if still nothing
      if (!dateRange) {
        parent.parent().find("p, span, strong").each((_, p) => {
          const text = $(p).text()
          if (/[A-Za-z]+ \d{1,2}.{0,30}\d{4}/.test(text) && !dateRange) {
            dateRange = parseDateRange(text)
          }
        })
      }

      if (!dateRange) return
      const [opening, closing] = dateRange
      if (closing < today) return

      const eventDate = opening >= today ? opening : today
      seen.add(title.toLowerCase())

      // Detail link from heading's anchor or parent link
      const hrefRaw = titleEl.find("a").attr("href") ?? titleEl.closest("a").attr("href")
      let ticketUrl = url
      if (hrefRaw) {
        ticketUrl = hrefRaw.startsWith("http")
          ? hrefRaw
          : `https://www.historytheatre.com${hrefRaw}`
      }

      events.push({
        id: `history-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${opening}`,
        artist: title,
        venue: VENUE,
        date: eventDate,
        time: "TBA",
        price: "tbd",
        ageRestriction: "all-ages",
        genres: ["theater"],
        mood: genreMoodMap["theater"],
        ticketUrl,
        imageUrl: "/placeholder-event.jpg",
        description: `${title} at History Theatre.`,
        popularity: 50,
        isLocalArtist: true,
      })
    })

    return events
  } catch {
    return []
  }
}
