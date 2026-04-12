/**
 * Scraper aggregator — runs all venue-specific scrapers and deduplicates
 * against a primary event list (typically Ticketmaster results).
 */

import type { Event } from "../types"
import { scrapeFirstAvenue } from "./first-avenue"
import { scrapeDakota } from "./dakota"
import { scrapeAcme } from "./acme"
import { scrapeHennepinArts } from "./hennepin-arts"
import { scrapeCedar } from "./cedar"
import { scrapeBryantLakeBowl } from "./bryant-lake-bowl"
import { scrapeParkway } from "./parkway"
import { scrapeJungle } from "./jungle"
import { scrapeParkSquare } from "./park-square"
import { scrapeHistoryTheatre } from "./history-theatre"

export { scrapeFirstAvenue, scrapeDakota, scrapeAcme, scrapeHennepinArts, scrapeCedar, scrapeBryantLakeBowl, scrapeParkway, scrapeJungle, scrapeParkSquare, scrapeHistoryTheatre }

/**
 * Run all scrapers in parallel and return the combined results.
 * Individual scraper failures are swallowed — a bad scrape never kills
 * the full data load.
 */
export async function scrapeAllVenues(): Promise<Event[]> {
  const results = await Promise.allSettled([
    scrapeFirstAvenue(),
    scrapeDakota(),
    scrapeAcme(),
    scrapeHennepinArts(),
    scrapeCedar(),
    scrapeBryantLakeBowl(),
    scrapeParkway(),
    scrapeJungle(),
    scrapeParkSquare(),
    scrapeHistoryTheatre(),
  ])

  const events: Event[] = []
  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(...result.value)
    }
  }
  return events
}

/**
 * Merge scraper events into a primary list, skipping any that appear to be
 * the same show (same artist name + same date + overlapping venue name).
 */
export function mergeWithPrimary(primary: Event[], scraped: Event[]): Event[] {
  // Build a lookup set: lowercase "artistName|date"
  const primaryKeys = new Set(
    primary.map((e) => `${e.artist.toLowerCase().trim()}|${e.date}`)
  )

  const unique = scraped.filter((e) => {
    const key = `${e.artist.toLowerCase().trim()}|${e.date}`
    return !primaryKeys.has(key)
  })

  return [...primary, ...unique]
}
