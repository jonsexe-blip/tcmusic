/**
 * Cedar Cultural Centre scraper
 * Source: https://www.eventbrite.com/o/the-cedar-cultural-center-20257335640
 *
 * Eventbrite embeds a JSON-LD block in window.__SERVER_DATA__.jsonld (a direct
 * top-level key). The array contains ListItem wrappers around Event objects.
 * Falls back to <script type="application/ld+json"> for forward-compatibility.
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
// Extract JSON-LD from window.__SERVER_DATA__.jsonld (Eventbrite's current format)
// ---------------------------------------------------------------------------

/**
 * Eventbrite embeds structured data in a JS variable rather than a plain
 * <script type="application/ld+json"> tag. The "jsonld" key sits at the top
 * level of __SERVER_DATA__ and its value is a JSON array.
 *
 * We extract it by finding the start of the array and counting brackets to
 * locate the matching close — this handles nested JSON without a full parse
 * of the potentially-large __SERVER_DATA__ object.
 */
function extractServerDataJsonLd(html: string): unknown[] {
  try {
    const keyIdx = html.indexOf('"jsonld":')
    if (keyIdx === -1) return []
    const arrStart = html.indexOf('[', keyIdx)
    if (arrStart === -1) return []
    let depth = 0
    let i = arrStart
    for (; i < html.length; i++) {
      const ch = html[i]
      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) break
      }
    }
    return JSON.parse(html.slice(arrStart, i + 1)) as unknown[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Shared event processing
// ---------------------------------------------------------------------------

function processLdItems(items: Array<{ "@type": string; item?: LDEvent } | LDEvent>): Event[] {
  const events: Event[] = []
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
  return events
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
  let allEvents: Event[] = []

  // Strategy 1: standard <script type="application/ld+json"> tags (legacy / future)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data: LDProfilePage = JSON.parse($(el).html() ?? "")
      if (data["@type"] === "ProfilePage" && data.mainEntity?.["@type"] === "ItemList") {
        allEvents = allEvents.concat(
          processLdItems(data.mainEntity.itemListElement ?? [])
        )
      }
    } catch {
      // skip
    }
  })

  // Strategy 2: Eventbrite's current __SERVER_DATA__.jsonld embed
  if (allEvents.length === 0) {
    const ldItems = extractServerDataJsonLd(html)

    // The array may contain bare ListItems (Events) or a ProfilePage wrapper
    for (const item of ldItems) {
      const obj = item as Record<string, unknown>
      if (obj["@type"] === "ProfilePage") {
        const mainEntity = obj.mainEntity as LDItemList | undefined
        if (mainEntity?.["@type"] === "ItemList") {
          allEvents = allEvents.concat(
            processLdItems(mainEntity.itemListElement ?? [])
          )
        }
      } else if (obj["@type"] === "ListItem" || obj["@type"] === "Event") {
        allEvents = allEvents.concat(
          processLdItems([obj as { "@type": string; item?: LDEvent } | LDEvent])
        )
      }
    }
  }

  // Deduplicate by id
  const seen = new Set<string>()
  return allEvents.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}
