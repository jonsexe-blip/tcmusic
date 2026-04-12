/**
 * Acme Comedy Company scraper
 * Source: https://acmecomedy.seatengine.com/events
 *
 * The seatengine page embeds a JSON-LD <script type="application/ld+json">
 * block at the venue level that contains an "Events" array — no JS execution
 * needed, just parse the structured data.
 *
 * Venue: 708 N 1st St, Minneapolis (Warehouse District)
 * Age restriction: 18+ per their standard policy
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const EVENTS_URL = "https://acmecomedy.seatengine.com/events"

const ACME_VENUE: Venue = {
  id: "acme-comedy-co",
  name: "Acme Comedy Co.",
  neighborhood: "north-loop",
  address: "708 N 1st St, Minneapolis, MN 55401",
  capacity: "small",
}

// ---------------------------------------------------------------------------
// JSON-LD types
// ---------------------------------------------------------------------------

interface LDEvent {
  "@type": string
  name: string
  startDate: string       // ISO 8601, e.g. "2026-04-12T02:30:00Z"
  description?: string
  image?: string
  url?: string
}

interface LDPlace {
  "@type": string
  name: string
  Events?: LDEvent[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(isoDate: string): string {
  // Convert to local date string "YYYY-MM-DD"
  // startDate is UTC — show dates are US Central; treat date portion as local
  const d = new Date(isoDate)
  // Use UTC date to avoid off-by-one from timezone conversion
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseTime(isoDate: string): string {
  const d = new Date(isoDate)
  const h = d.getUTCHours()
  const min = d.getUTCMinutes()
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(min).padStart(2, "0")} ${period}`
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr) >= today
}

// ---------------------------------------------------------------------------
// Fetch & parse
// ---------------------------------------------------------------------------

export async function scrapeAcme(): Promise<Event[]> {
  let html: string
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) throw new Error(`Acme fetch failed: ${res.status}`)
    html = await res.text()
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const events: Event[] = []

  // Find the JSON-LD block with @type=Place containing Events[]
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() ?? ""
      // The JSON has a leading colon bug on some keys — strip it
      const cleaned = raw.replace(/"\s*:\s*"@/g, '":"@').replace(/":\s*"@context"/g, '":"@context"')
      const data: LDPlace = JSON.parse(cleaned)
      if (data["@type"] !== "Place" || !Array.isArray(data.Events)) return

      for (const ev of data.Events) {
        try {
          if (ev["@type"] !== "Event") continue
          const date = parseDate(ev.startDate)
          if (!isUpcoming(date)) continue

          const artist = ev.name.trim()
          const description = ev.description
            ? stripHtml(ev.description).slice(0, 300)
            : `${artist} live at Acme Comedy Co.`

          events.push({
            id: `acme-${artist.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
            artist,
            venue: ACME_VENUE,
            date,
            time: parseTime(ev.startDate),
            price: "tbd",
            ageRestriction: "18+",
            genres: ["comedy"],
            mood: genreMoodMap["comedy"] ?? "chill",
            ticketUrl: ev.url ?? EVENTS_URL,
            imageUrl: ev.image ?? "/placeholder-event.jpg",
            description,
            popularity: 50,
            isLocalArtist: false,
          })
        } catch {
          // Skip malformed events
        }
      }
    } catch {
      // Skip non-JSON or unrelated LD blocks
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
