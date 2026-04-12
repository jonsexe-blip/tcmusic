import type { TMEvent, TMEventsResponse } from "./types"

const BASE_URL = "https://app.ticketmaster.com/discovery/v2"
// DMA 336 = Minneapolis-St. Paul metro area
const MPLS_DMA_ID = "336"
const CACHE_TTL = 3600 // 1 hour in seconds

function getApiKey(): string | null {
  const key = process.env.TICKETMASTER_API_KEY
  if (!key || key === "your_ticketmaster_api_key_here") return null
  return key
}

export interface FetchTMEventsOptions {
  size?: number
  page?: number
  startDateTime?: string // ISO 8601, e.g. "2024-01-01T00:00:00Z"
  endDateTime?: string
  classificationName?: string
}

async function fetchTMEventsRaw(
  options: FetchTMEventsOptions = {}
): Promise<TMEvent[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  const {
    size = 200,
    page = 0,
    startDateTime,
    endDateTime,
    classificationName,
  } = options

  const params = new URLSearchParams({
    apikey: apiKey,
    dmaId: MPLS_DMA_ID,
    size: String(size),
    page: String(page),
    sort: "date,asc",
  })

  if (classificationName) params.set("classificationName", classificationName)
  if (startDateTime) params.set("startDateTime", startDateTime)
  if (endDateTime) params.set("endDateTime", endDateTime)

  const url = `${BASE_URL}/events.json?${params.toString()}`
  const res = await fetch(url, { cache: "no-store" })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ticketmaster API error ${res.status}: ${text}`)
  }

  const data: TMEventsResponse = await res.json()
  return data._embedded?.events ?? []
}

export async function fetchTMEvents(
  options: FetchTMEventsOptions = {}
): Promise<TMEvent[]> {
  // Fetch music, comedy, and sports in parallel
  const [music, comedy, sports] = await Promise.all([
    fetchTMEventsRaw({ ...options, classificationName: "music" }),
    fetchTMEventsRaw({ ...options, size: 50, classificationName: "comedy" }),
    fetchTMEventsRaw({ ...options, size: 50, classificationName: "sports" }),
  ])

  // Deduplicate by event ID
  const seen = new Set<string>()
  return [...music, ...comedy, ...sports].filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

export async function fetchTMEventById(id: string): Promise<TMEvent | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null
  const url = `${BASE_URL}/events/${encodeURIComponent(id)}.json?apikey=${apiKey}`

  const res = await fetch(url, { cache: "no-store" })

  if (res.status === 404) return null

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ticketmaster API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<TMEvent>
}
