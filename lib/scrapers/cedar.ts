/**
 * Cedar Cultural Centre scraper
 * Source: https://www.eventbrite.com/o/the-cedar-cultural-center-20257335640
 *
 * The Eventbrite organizer page embeds a JSON-LD <script type="application/ld+json">
 * block of type ProfilePage containing an ItemList of Event objects — no JS
 * execution needed. Lists ~24 upcoming events per page.
 *
 * Venue: 416 Cedar Ave S, Minneapolis (Cedar-Riverside / Seward)
 * Genre: folk (closest match until a dedicated "world" genre is added)
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const ORGANIZER_URL =
  "https://www.eventbrite.com/o/the-cedar-cultural-center-20257335640"

const CEDAR_VENUE: Venue = {
  id: "cedar-cultural-centre",
  name: "Cedar Cultural Centre",
  neighborhood: "seward",
  address: "416 Cedar Ave S, Minneapolis, MN 55454",
  capacity: "medium",
}

// ---------------------------------------------------------------------------
// JSON-LD types (Eventbrite ProfilePage / ItemList shape)
// ---------------------------------------------------------------------------

interface LDOffer {
  lowPrice?: number | string
  highPrice?: number | string
  price?: number | string
  priceCurrency?: string
}

interface LDEvent {
  "@type": string
  name: string
  startDate: string       // ISO 8601, e.g. "2026-05-03T19:30:00-05:00"
  endDate?: string
  description?: string
  image?: string | { url?: string }
  url?: string
  offers?: LDOffer | LDOffer[]
  location?: { name?: string; address?: { streetAddress?: string } }
}

interface LDItemList {
  "@type": string
  itemListElement?: Array<{ "@type": string; item?: LDEvent } | LDEvent>
}

interface LDProfilePage {
  "@type": string
  mainEntity?: LDItemList
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(isoDate: string): string {
  const d = new Date(isoDate)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseTime(isoDate: string): string {
  const d = new Date(isoDate)
  const h = d.getHours()
  const min = d.getMinutes()
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(min).padStart(2, "0")} ${period}`
}

function parsePrice(offers: LDOffer | LDOffer[] | undefined): Event["price"] {
  if (!offers) return "tbd"
  const offer = Array.isArray(offers) ? offers[0] : offers
  const low = offer.lowPrice ?? offer.price
  const high = offer.highPrice ?? offer.price
  if (low === 0 || low === "0") return "free"
  const min = typeof low === "string" ? parseFloat(low) : (low as number)
  const max = typeof high === "string" ? parseFloat(high) : (high as number)
  if (!isNaN(min) && !isNaN(max) && max > 0) return { min, max }
  if (!isNaN(min) && min > 0) return { min, max: min }
  return "tbd"
}

function getImageUrl(image: LDEvent["image"]): string {
  if (!image) return "/placeholder-event.jpg"
  if (typeof image === "string") return image
  return image.url ?? "/placeholder-event.jpg"
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
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
    const res = await fetch(ORGANIZER_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) throw new Error(`Cedar fetch failed: ${res.status}`)
    html = await res.text()
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const events: Event[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data: LDProfilePage = JSON.parse($(el).html() ?? "")
      if (data["@type"] !== "ProfilePage" || !data.mainEntity) return
      if (data.mainEntity["@type"] !== "ItemList") return

      const items = data.mainEntity.itemListElement ?? []

      for (const item of items) {
        try {
          // Items can be bare LDEvent or wrapped in { "@type": "ListItem", item: LDEvent }
          const ev: LDEvent = ("item" in item && item.item) ? item.item : (item as LDEvent)
          if (ev["@type"] !== "Event" || !ev.name || !ev.startDate) continue

          const date = parseDate(ev.startDate)
          if (!isUpcoming(date)) continue

          const artist = ev.name.trim()
          const description = ev.description
            ? stripHtml(ev.description).slice(0, 300)
            : `${artist} live at the Cedar Cultural Centre.`

          events.push({
            id: `cedar-${artist.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
            artist,
            venue: CEDAR_VENUE,
            date,
            time: parseTime(ev.startDate),
            price: parsePrice(ev.offers),
            ageRestriction: "all-ages",
            genres: ["world"],
            mood: genreMoodMap["world"] ?? "chill",
            ticketUrl: ev.url ?? ORGANIZER_URL,
            imageUrl: getImageUrl(ev.image),
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
