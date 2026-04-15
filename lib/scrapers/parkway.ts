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
import type { Event, Genre, Venue } from "../types"
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

// Categories to skip (film screenings, private events, etc.)
const SKIP_CATEGORIES = new Set(["movies", "films", "film", "movie", "private"])

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + "T00:00:00") >= today
}

function mapCategories(cats: string[]): Genre[] {
  const lower = cats.map((c) => c.toLowerCase())
  if (lower.some((c) => c.includes("comedy"))) return ["comedy"]
  return ["indie"]
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

function parseTimeText(text: string): string {
  // "7:30 PM – 10:30 PM" → "7:30 PM"
  // "7:30PM" → "7:30 PM"
  const m = text.match(/(\d{1,2}:\d{2}\s*[AP]M)/i)
  if (!m) return "TBA"
  return m[1]!.replace(/([AP]M)/i, " $1").replace(/\s+/g, " ").trim()
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

  // ---------------------------------------------------------------------------
  // Strategy 1: Squarespace standard eventlist markup
  //   article.eventlist-event (or li.eventlist-event)
  //   time[datetime] → ISO date, .eventlist-title a → title, .eventlist-meta-time → time
  // ---------------------------------------------------------------------------
  const eventEls = $("article.eventlist-event, li.eventlist-event, .eventlist-event").toArray()

  if (eventEls.length > 0) {
    for (const el of eventEls) {
      try {
        const $el = $(el)

        // Title
        const titleEl = $el.find(".eventlist-title a, h1 a, h2 a").first()
        const title = titleEl.text().trim()
        if (!title) continue

        // Categories — skip film events
        const categories = $el.find(".eventlist-cats a, .event-cats a, [class*='cat'] a")
          .map((_, a) => $(a).text().trim()).get()
        if (categories.map((c) => c.toLowerCase()).some((c) => SKIP_CATEGORIES.has(c))) continue

        // Date — prefer datetime attribute on <time>, fallback to text
        let date: string | null = null
        const timeEl = $el.find("time[datetime]").first()
        const datetimeAttr = timeEl.attr("datetime") ?? ""
        if (datetimeAttr.match(/^\d{4}-\d{2}-\d{2}/)) {
          date = datetimeAttr.slice(0, 10)
        } else {
          const dateText = $el.find(".eventlist-datetag, .event-date, time").first().text().trim()
          date = parseShortDate(dateText)
        }
        if (!date || !isUpcoming(date)) continue

        // Time
        const timeText = $el.find(".eventlist-meta-time, .event-time, time").last().text().trim()
        const time = parseTimeText(timeText)

        // Ticket URL
        const href = titleEl.attr("href") ?? ""
        const ticketUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`

        // Description
        const description =
          $el.find(".eventlist-excerpt, p").first().text().trim().slice(0, 300)
          || `${title} at the Parkway Theater.`

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
        // skip
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy 2: link-harvest fallback — grab all /all-events/ links and infer
  // date/title from surrounding text. Used when Squarespace renders with a
  // non-standard template or the standard classes aren't present.
  // ---------------------------------------------------------------------------
  if (events.length === 0) {
    const seen = new Set<string>()
    $("a[href*='/all-events/']").each((_, el) => {
      try {
        const $el = $(el)
        const href = $el.attr("href") ?? ""
        if (!href.match(/\/all-events\/.+/) || seen.has(href)) return
        seen.add(href)

        const title = $el.text().trim() || $el.find("h1,h2,h3").first().text().trim()
        if (!title || title.length < 3) return

        // Try to find a date in surrounding text (parent, siblings)
        const containerText = $el.closest("article, li, div").text()
        const date = parseShortDate(containerText)
        if (!date || !isUpcoming(date)) return

        // Skip obvious film events
        if (/\bfilm\b|\bmovie\b|\bscreening\b/i.test(title)) return

        const ticketUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`
        const time = parseTimeText(containerText)

        events.push({
          id: `parkway-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
          artist: title,
          venue: PARKWAY_VENUE,
          date,
          time,
          price: "tbd",
          ageRestriction: "all-ages",
          genres: ["indie"],
          mood: genreMoodMap["indie"],
          ticketUrl,
          imageUrl: "/placeholder-event.jpg",
          description: `${title} at the Parkway Theater.`,
          popularity: 50,
          isLocalArtist: false,
        })
      } catch {
        // skip
      }
    })
  }

  // Deduplicate by id
  const deduped = new Set<string>()
  return events.filter((e) => {
    if (deduped.has(e.id)) return false
    deduped.add(e.id)
    return true
  })
}
