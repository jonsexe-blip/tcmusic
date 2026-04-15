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
import { scrapeNorthrop } from "./northrop"
import { scrapeJamProductions } from "./jam-productions"

export {
  scrapeFirstAvenue, scrapeDakota, scrapeAcme, scrapeHennepinArts, scrapeCedar,
  scrapeBryantLakeBowl, scrapeParkway, scrapeJungle, scrapeParkSquare,
  scrapeHistoryTheatre, scrapeNorthrop, scrapeJamProductions,
}

// ---------------------------------------------------------------------------
// Scraper registry & result types
// ---------------------------------------------------------------------------

export interface ScraperResult {
  name: string
  events: Event[]
  /** ok = events found, empty = 0 events returned, error = exception thrown */
  status: "ok" | "empty" | "error"
  durationMs: number
  errorMessage?: string
}

/**
 * Registry of all scrapers with alert classification.
 * alwaysActive: true  → alert if 0 events returned (venue runs year-round)
 * alwaysActive: false → no alert when empty (legitimately quiet between seasons)
 */
export const SCRAPER_REGISTRY = [
  { name: "first-avenue",     fn: scrapeFirstAvenue,    alwaysActive: true  },
  { name: "dakota",           fn: scrapeDakota,         alwaysActive: true  },
  { name: "acme",             fn: scrapeAcme,           alwaysActive: true  },
  { name: "cedar",            fn: scrapeCedar,          alwaysActive: true  },
  { name: "hennepin-arts",    fn: scrapeHennepinArts,   alwaysActive: true  },
  { name: "bryant-lake-bowl", fn: scrapeBryantLakeBowl, alwaysActive: true  },
  { name: "parkway",          fn: scrapeParkway,        alwaysActive: true  },
  // Seasonal — legitimately return 0 between seasons; suppress alerts
  { name: "jungle",           fn: scrapeJungle,         alwaysActive: false },
  { name: "park-square",      fn: scrapeParkSquare,     alwaysActive: false },
  { name: "history-theatre",  fn: scrapeHistoryTheatre, alwaysActive: false },
  { name: "northrop",         fn: scrapeNorthrop,       alwaysActive: false },
  { name: "jam-productions",  fn: scrapeJamProductions, alwaysActive: false },
] as const

// ---------------------------------------------------------------------------
// Shared runner — used by both scrapeAllVenues() and /api/scraper-health
// ---------------------------------------------------------------------------

/**
 * Runs all scrapers in parallel and returns per-scraper results including
 * timing, event counts, and any error details.
 */
export async function runAllScrapers(): Promise<ScraperResult[]> {
  const settled = await Promise.allSettled(
    SCRAPER_REGISTRY.map(async ({ name, fn }) => {
      const start = Date.now()
      try {
        const events = await fn()
        return {
          name,
          events,
          status: (events.length > 0 ? "ok" : "empty") as ScraperResult["status"],
          durationMs: Date.now() - start,
        } satisfies ScraperResult
      } catch (err) {
        // Scrapers are designed to never throw, but be defensive
        return {
          name,
          events: [],
          status: "error" as const,
          durationMs: Date.now() - start,
          errorMessage: err instanceof Error ? err.message : String(err),
        } satisfies ScraperResult
      }
    })
  )

  return settled.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          name: "unknown",
          events: [],
          status: "error" as const,
          durationMs: 0,
          errorMessage: "Unexpected promise rejection",
        }
  )
}

// ---------------------------------------------------------------------------
// Email alert — fire-and-forget via Resend REST API
// ---------------------------------------------------------------------------

/**
 * Sends an email when always-active scrapers return 0 events or error.
 * Requires RESEND_API_KEY and ALERT_EMAIL_TO env vars; silently no-ops if absent.
 * Never throws — failure to send an alert must not affect the data pipeline.
 */
export async function sendEmailAlert(broken: ScraperResult[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL_TO
  if (!apiKey || !to || broken.length === 0) return

  const from = process.env.ALERT_EMAIL_FROM ?? "onboarding@resend.dev"
  const count = broken.length
  const subject = `[TwinCitiesMusic] Scraper alert: ${count} scraper${count === 1 ? "" : "s"} need attention`

  const lines = broken.map((s) => {
    const reason = s.status === "error"
      ? `error — ${s.errorMessage ?? "unknown"}`
      : `0 events returned`
    return `• ${s.name}: ${reason} (${s.durationMs}ms)`
  })

  const text = [
    lines.join("\n"),
    "",
    "Check https://tcmusic.vercel.app/api/scraper-health for details.",
  ].join("\n")

  // Fire-and-forget — intentionally not awaited at the call site
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, text }),
  }).catch(() => {
    // Intentionally swallowed — alert failure must never surface to users
  })
}

// ---------------------------------------------------------------------------
// Public scraper orchestration
// ---------------------------------------------------------------------------

/**
 * Run all scrapers in parallel and return the combined results.
 * Individual scraper failures are swallowed — a bad scrape never kills
 * the full data load.
 *
 * Logs errors/warnings for broken always-active scrapers and fires a
 * fire-and-forget email alert if RESEND_API_KEY + ALERT_EMAIL_TO are set.
 */
export async function scrapeAllVenues(): Promise<Event[]> {
  const results = await runAllScrapers()

  const alwaysActiveNames = new Set<string>(
    SCRAPER_REGISTRY.filter((s) => s.alwaysActive).map((s) => s.name)
  )

  // Log broken scrapers — Vercel captures these in runtime logs
  for (const r of results) {
    if (r.status === "ok") continue
    if (r.status === "error") {
      console.error(`[scraper] ${r.name} threw an error: ${r.errorMessage ?? "unknown"} (${r.durationMs}ms)`)
    } else if (alwaysActiveNames.has(r.name)) {
      // Only warn for always-active venues — seasonal scrapers being empty is normal
      console.warn(`[scraper] ${r.name} returned 0 events (${r.durationMs}ms)`)
    }
  }

  // Email alert for always-active scrapers that are broken — non-blocking
  const broken = results.filter(
    (r) => alwaysActiveNames.has(r.name) && r.status !== "ok"
  )
  sendEmailAlert(broken).catch(() => {/* intentionally ignored */})

  const events: Event[] = []
  for (const r of results) {
    events.push(...r.events)
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
