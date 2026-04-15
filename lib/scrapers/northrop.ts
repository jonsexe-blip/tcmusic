/**
 * Northrop at UMN scraper
 * Source: https://northrop.umn.edu/events
 *
 * Northrop is a performing-arts venue on the UMN campus hosting dance, classical
 * music, and touring artists. Events are server-rendered Drupal HTML with
 * individual event pages containing JSON-LD (@type: Event) for structured data.
 *
 * Venue: 84 Church St SE, Minneapolis, MN 55455 (Dinkytown / UMN campus)
 */

import * as cheerio from "cheerio"
import type { Event, Venue } from "../types"
import { genreMoodMap } from "../types"

const BASE_URL = "https://northrop.umn.edu"
const EVENTS_URL = `${BASE_URL}/events`

const NORTHROP_VENUE: Venue = {
  id: "northrop-umn",
  name: "Northrop",
  neighborhood: "dinkytown",
  address: "84 Church St SE, Minneapolis, MN 55455",
  capacity: "large",
}

// ---------------------------------------------------------------------------
// JSON-LD types for individual event pages
// ---------------------------------------------------------------------------

interface LDEvent {
  "@type": string
  name?: string
  startDate?: string
  endDate?: string
  description?: string
  image?: string | { url?: string }
  url?: string
  offers?: { url?: string; price?: string | number; priceCurrency?: string } | Array<{ url?: string }>
  location?: { name?: string; address?: unknown }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
}

function parseShortDate(text: string): string | null {
  // Handles "Apr 14", "April 14", "Apr. 14", etc.
  const m = text.match(/([A-Za-z]+)\.?\s+(\d{1,2})/)
  if (!m) return null
  const month = MONTH_MAP[m[1]!.toLowerCase().slice(0, 3)]
  if (!month) return null
  const day = m[2]!.padStart(2, "0")
  // Infer year
  const now = new Date()
  const eventMonth = parseInt(month, 10)
  const year = eventMonth < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear()
  return `${year}-${month}-${day}`
}

function parseISODate(iso: string): string {
  // Handle "2026-04-18" or "2026-04-18T19:30:00-05:00"
  return iso.slice(0, 10)
}

function parseISOTime(iso: string): string {
  if (!iso.includes("T")) return "TBA"
  const timePart = iso.split("T")[1]!.slice(0, 5) // "19:30"
  const [h, m] = timePart.split(":")
  const hour = parseInt(h!, 10)
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${period}`
}

function getImageFromLD(image: LDEvent["image"]): string {
  if (!image) return "/placeholder-event.jpg"
  if (typeof image === "string") return image
  return image.url ?? "/placeholder-event.jpg"
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim()
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + "T00:00:00") >= today
}

// ---------------------------------------------------------------------------
// Fetch individual event page and extract JSON-LD
// ---------------------------------------------------------------------------

async function fetchEventDetails(eventUrl: string): Promise<{
  startDate: string | null
  time: string
  imageUrl: string
  description: string
  ticketUrl: string
  price: Event["price"]
} | null> {
  try {
    const res = await fetch(eventUrl, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) return null
    const html = await res.text()
    const $ = cheerio.load(html)

    let ld: LDEvent | null = null
    $('script[type="application/ld+json"]').each((_, el) => {
      if (ld) return
      try {
        const data = JSON.parse($(el).html() ?? "")
        if (data["@type"] === "Event") ld = data as LDEvent
        // Some pages wrap in @graph array
        if (Array.isArray(data["@graph"])) {
          const ev = data["@graph"].find((n: { "@type": string }) => n["@type"] === "Event")
          if (ev) ld = ev as LDEvent
        }
      } catch {
        // skip
      }
    })

    // Fallback: ticket link from page HTML
    const ticketLink = $("a[href*='tickets.umn.edu']").first().attr("href")
      ?? $("a[href*='ticketmaster']").first().attr("href")
      ?? eventUrl

    if (!ld) {
      // No JSON-LD — extract what we can from page text
      const fullText = $("body").text()
      const dateMatch = fullText.match(
        /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})/i
      )
      if (!dateMatch) return null
      const month = MONTH_MAP[dateMatch[1]!.toLowerCase().slice(0, 3)] ?? "01"
      const day = dateMatch[2]!.padStart(2, "0")
      const year = dateMatch[3]!
      return {
        startDate: `${year}-${month}-${day}`,
        time: "TBA",
        imageUrl: "/placeholder-event.jpg",
        description: "",
        ticketUrl: ticketLink,
        price: "tbd",
      }
    }

    // TypeScript can't narrow through the .each() callback; assert non-null here
    const ldSafe = ld as LDEvent
    const startDate = ldSafe.startDate ? parseISODate(ldSafe.startDate) : null
    const time = ldSafe.startDate && ldSafe.startDate.includes("T")
      ? parseISOTime(ldSafe.startDate)
      : "TBA"
    const imageUrl = getImageFromLD(ldSafe.image)
    const description = ldSafe.description ? stripHtml(ldSafe.description).slice(0, 300) : ""

    // Price from offers (cast to a permissive type to avoid union narrowing issues)
    let price: Event["price"] = "tbd"
    if (ldSafe.offers) {
      const offer = (Array.isArray(ldSafe.offers) ? ldSafe.offers[0] : ldSafe.offers) as {
        price?: string | number
      }
      const raw = offer.price
      if (raw === 0 || raw === "0") price = "free"
      else if (raw !== undefined) {
        const n = typeof raw === "string" ? parseFloat(raw) : (raw as number)
        if (!isNaN(n) && n > 0) price = { min: n, max: n }
      }
    }

    return { startDate, time, imageUrl, description, ticketUrl: ticketLink, price }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Fetch & parse event list
// ---------------------------------------------------------------------------

export async function scrapeNorthrop(): Promise<Event[]> {
  let html: string
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TwinCitiesMusic/1.0)" },
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  const $ = cheerio.load(html)
  const eventLinks: { slug: string; title: string; dateHint: string | null; imageUrl: string }[] = []

  // Primary selector: Drupal event-item divs
  $(".event-item, .views-row, article.event").each((_, el) => {
    try {
      const $el = $(el)
      const titleLink = $el.find("h3 a, h2 a, h4 a").first()
      const title = titleLink.text().trim()
      const href = titleLink.attr("href") ?? $el.find("a[href*='/events/']").first().attr("href") ?? ""
      if (!title || !href) return

      const slug = href.startsWith("http") ? href : `${BASE_URL}${href}`
      if (!slug.includes("/events/")) return

      // Date hint from listing (e.g. "Apr 14" or "Apr 18")
      const dateText = $el.find(".date, .event-date, time").first().text().trim()
      const dateHint = dateText ? parseShortDate(dateText) : null

      // Image from listing (optional)
      const imgSrc = $el.find("img").first().attr("src") ?? ""
      const imageUrl = imgSrc
        ? (imgSrc.startsWith("http") ? imgSrc : `${BASE_URL}${imgSrc}`)
        : "/placeholder-event.jpg"

      eventLinks.push({ slug, title, dateHint, imageUrl })
    } catch {
      // skip
    }
  })

  // Fallback: harvest all /events/ links if no event-item structure found
  if (eventLinks.length === 0) {
    const seen = new Set<string>()
    $("a[href*='/events/']").each((_, el) => {
      const href = $(el).attr("href") ?? ""
      const slug = href.startsWith("http") ? href : `${BASE_URL}${href}`
      // Skip the base /events/ page itself and non-show pages
      if (!slug.match(/\/events\/[a-z0-9-]+-\d{4}$/) || seen.has(slug)) return
      seen.add(slug)
      const title = $(el).text().trim()
      if (title && title.length > 3) {
        eventLinks.push({ slug, title, dateHint: null, imageUrl: "/placeholder-event.jpg" })
      }
    })
  }

  if (eventLinks.length === 0) return []

  // Fetch event details in parallel (batched to avoid hammering)
  const BATCH = 8
  const results: Event[] = []
  for (let i = 0; i < eventLinks.length; i += BATCH) {
    const batch = eventLinks.slice(i, i + BATCH)
    const details = await Promise.all(
      batch.map(async ({ slug, title, dateHint, imageUrl: listingImage }) => {
        const d = await fetchEventDetails(slug)
        const date = d?.startDate ?? dateHint
        if (!date || !isUpcoming(date)) return null

        const artist = title.trim()
        const description = d?.description || `${artist} at Northrop.`

        return {
          id: `northrop-${artist.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}`,
          artist,
          venue: NORTHROP_VENUE,
          date,
          time: d?.time ?? "TBA",
          price: d?.price ?? "tbd",
          ageRestriction: "all-ages" as const,
          genres: ["classical" as const],
          mood: genreMoodMap["classical"],
          ticketUrl: d?.ticketUrl ?? slug,
          imageUrl: d?.imageUrl && d.imageUrl !== "/placeholder-event.jpg"
            ? d.imageUrl
            : listingImage,
          description,
          popularity: 50,
          isLocalArtist: false,
        } satisfies Event
      })
    )
    for (const e of details) {
      if (e) results.push(e)
    }
  }

  // Deduplicate by id
  const seen = new Set<string>()
  return results.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}
