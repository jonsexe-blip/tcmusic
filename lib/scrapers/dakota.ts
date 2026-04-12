/**
 * Dakota Jazz Club scraper
 * Source: https://www.dakotacooks.com/wp-json/tribe/events/v1/events
 *
 * Uses The Events Calendar (TEC) WordPress REST API — clean JSON, no JS needed.
 * Returns up to 200 events per request (capped at 100 per page, paginated).
 */

import type { Event, Venue, EventPrice } from "../types"
import { genreMoodMap } from "../types"

const BASE_URL = "https://www.dakotacooks.com/wp-json/tribe/events/v1/events"

const DAKOTA_VENUE: Venue = {
  id: "dakota-jazz-club",
  name: "Dakota Jazz Club",
  neighborhood: "downtown-mpls",
  address: "1010 Nicollet Mall, Minneapolis, MN 55403",
  capacity: "medium",
}

// ---------------------------------------------------------------------------
// TEC API types (minimal — only fields we use)
// ---------------------------------------------------------------------------

interface TECImage {
  url: string
}

interface TECEvent {
  id: number
  title: string
  start_date: string   // "2025-07-14 19:00:00"
  end_date: string
  url: string
  image?: TECImage
  cost?: string        // "$25 – $35" or "Free" or ""
  description?: string // HTML
}

interface TECResponse {
  events: TECEvent[]
  total: number
  total_pages: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePrice(cost?: string): EventPrice | "free" | "tbd" {
  if (!cost) return "tbd"
  const lower = cost.toLowerCase().trim()
  if (!lower || lower === "free") return "free"
  // Try to extract numeric range, e.g. "$25 – $35" → { min: 25, max: 35 }
  const nums = lower.match(/\d+/g)?.map(Number) ?? []
  if (nums.length >= 2) return { min: nums[0], max: nums[nums.length - 1] }
  if (nums.length === 1) return { min: nums[0], max: nums[0] }
  return "tbd"
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function formatDate(startDate: string): string {
  // "2025-07-14 19:00:00" → "2025-07-14"
  return startDate.split(" ")[0]
}

function formatTime(startDate: string): string {
  // "2025-07-14 19:00:00" → "7:00 PM"
  const timePart = startDate.split(" ")[1]
  if (!timePart) return "TBA"
  const [h, m] = timePart.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${period}`
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr) >= today
}

// ---------------------------------------------------------------------------
// Fetch one page
// ---------------------------------------------------------------------------

async function fetchPage(page: number): Promise<TECResponse> {
  const url = `${BASE_URL}?per_page=100&page=${page}&status=publish`
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
  })
  if (!res.ok) throw new Error(`Dakota fetch failed: ${res.status}`)
  return res.json() as Promise<TECResponse>
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export async function scrapeDakota(): Promise<Event[]> {
  let page = 1
  let totalPages = 1
  const events: Event[] = []

  while (page <= totalPages) {
    try {
      const data = await fetchPage(page)
      totalPages = data.total_pages ?? 1

      for (const raw of data.events ?? []) {
        try {
          const date = formatDate(raw.start_date)
          if (!isUpcoming(date)) continue

          const title = raw.title.replace(/&#8211;/g, "–").replace(/&amp;/g, "&").trim()
          // Dakota titles are often "Artist Name" or "Artist Name – Tour Name"
          const artist = title.split(/\s*[–—]\s*/)[0].trim() || title

          const description = raw.description
            ? stripHtml(raw.description).slice(0, 300)
            : `${artist} live at Dakota Jazz Club.`

          events.push({
            id: `dakota-${raw.id}`,
            artist,
            venue: DAKOTA_VENUE,
            date,
            time: formatTime(raw.start_date),
            price: parsePrice(raw.cost),
            ageRestriction: "all-ages",
            genres: ["jazz"],
            mood: genreMoodMap["jazz"],
            ticketUrl: raw.url,
            imageUrl: raw.image?.url ?? "/placeholder-event.jpg",
            description,
            popularity: 50,
            isLocalArtist: false,
          })
        } catch {
          // Skip malformed entries
        }
      }

      page++
    } catch {
      break
    }
  }

  return events
}
