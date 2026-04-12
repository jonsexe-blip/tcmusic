/**
 * Jungle Theater scraper
 * Source: https://www.jungletheater.org/{YEAR}-{YEAR+1}-season (Squarespace)
 *
 * Strategy: heading-centric — walk all h2/h3 elements, collect date range from
 * nearby text, skip cancelled shows, use closing date to determine if the run
 * is still worth showing.
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const VENUE: Venue = {
  id: "jungle-theater",
  name: "Jungle Theater",
  neighborhood: "uptown",
  address: "2951 Lyndale Ave S, Minneapolis, MN 55408",
  capacity: "small",
}

function currentSeasonSlug(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startYear = month >= 6 ? year : year - 1
  const endYear = startYear + 1
  return `${startYear}-${String(endYear).slice(-2)}-season`
}

/**
 * Parse opening and closing dates from strings like:
 *   "October 4 – November 2, 2025"
 *   "December 6, 2025 - January 4, 2026"
 * Returns [openingDateStr, closingDateStr] (YYYY-MM-DD), or null if unparseable.
 */
function parseDateRange(raw: string): [string, string] | null {
  // Find the year — prefer last year match (closing date year)
  const years = [...raw.matchAll(/\d{4}/g)].map((m) => parseInt(m[0]))
  const closingYear = years.at(-1) ?? new Date().getFullYear()
  const openingYear = years[0] ?? closingYear

  // Match all "Month D" patterns
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

async function fetchSeasonPage(slug: string): Promise<Event[]> {
  const url = `https://www.jungletheater.org/${slug}`
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

  // Heading-centric: find each show title heading
  $("h2, h3").each((_, heading) => {
    const titleEl = $(heading)
    const title = titleEl.text().trim()
    if (!title || title.length < 3) return
    // Skip navigation / generic headings
    if (/season|subscribe|about|contact|support|series/i.test(title) && title.length < 40) return
    if (seen.has(title.toLowerCase())) return

    // Walk up to find a container block with enough context
    const container = titleEl.closest("div, section, article")

    // Check container text for "cancel" — skip cancelled shows
    const containerText = container.text()
    if (/cancel/i.test(containerText)) return

    // Look for date range pattern anywhere near this heading
    let dateRange: [string, string] | null = null
    container.find("p, span, li").each((_, p) => {
      const text = $(p).text()
      if (/[A-Za-z]+ \d{1,2}.{0,30}\d{4}/.test(text) && !dateRange) {
        dateRange = parseDateRange(text)
      }
    })

    // Also check text nodes in adjacent siblings
    if (!dateRange) {
      const sibText = titleEl.next("p").text() + " " + titleEl.parent().text()
      if (/[A-Za-z]+ \d{1,2}.{0,30}\d{4}/.test(sibText)) {
        dateRange = parseDateRange(sibText)
      }
    }

    if (!dateRange) return
    const [opening, closing] = dateRange

    // Include if closing date is today or future
    if (closing < today) return

    // Use opening date if it's upcoming; otherwise use today (show is mid-run)
    const eventDate = opening >= today ? opening : today

    seen.add(title.toLowerCase())

    // Image — first in container
    const imgSrc = container.find("img[src]").first().attr("src") ?? "/placeholder-event.jpg"

    // Ticket link
    let ticketUrl = url
    container.find("a[href]").each((_, a) => {
      const href = $(a).attr("href") ?? ""
      if (/ticket|ovation|buy/i.test(href)) ticketUrl = href
    })

    events.push({
      id: `jungle-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${opening}`,
      artist: title,
      venue: VENUE,
      date: eventDate,
      time: "TBA",
      price: "tbd",
      ageRestriction: "all-ages",
      genres: ["theater"],
      mood: genreMoodMap["theater"],
      ticketUrl,
      imageUrl: imgSrc,
      description: `${title} at Jungle Theater.`,
      popularity: 55,
      isLocalArtist: true,
    })
  })

  return events
}

export async function scrapeJungle(): Promise<Event[]> {
  const slug = currentSeasonSlug()
  try {
    // Try current season, then next season (announced early), then previous
    const [current, next] = await Promise.all([
      fetchSeasonPage(slug),
      (async () => {
        const now = new Date()
        const startYear = (now.getMonth() + 1 >= 6 ? now.getFullYear() : now.getFullYear() - 1) + 1
        const nextSlug = `${startYear}-${String(startYear + 1).slice(-2)}-season`
        return fetchSeasonPage(nextSlug)
      })(),
    ])
    const merged = [...current, ...next]
    return merged
  } catch {
    return []
  }
}
