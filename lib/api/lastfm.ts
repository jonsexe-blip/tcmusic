/**
 * Last.fm API — artist listener counts + tag-based genre enrichment
 *
 * Uses artist.getInfo to get scrobble/listener stats and crowd-sourced tags.
 * Listener count feeds the popularity score (log-scaled 0–100).
 * Tags are used as a genre fallback when Spotify has no data.
 *
 * Rate limit: 5 req/sec averaged over 5 min — safe to batch in chunks of 10.
 */

import type { Genre } from "../types"
import { spotifyGenresToGenre } from "./spotify"

const BASE_URL = "https://ws.audioscrobbler.com/2.0/"

export interface LastFmArtistData {
  listeners: number
  playcount: number
  tags: string[]       // raw Last.fm tag names
  mappedGenre: Genre | null
}

// ---------------------------------------------------------------------------
// Popularity scoring — log scale so a local 10k-listener act isn't buried
// under 10M-listener headliners.
//
//   0 listeners  →  0
//   1 000         → ~43
//   10 000        → ~57
//   100 000       → ~71
//   1 000 000     → ~86
//   10 000 000    → 100
// ---------------------------------------------------------------------------

export function listenersToPopularity(listeners: number): number {
  if (listeners <= 0) return 30 // default for unknown — not zero so they still appear
  return Math.min(100, Math.round((Math.log10(listeners + 1) / 7) * 100))
}

// ---------------------------------------------------------------------------
// Single artist lookup
// ---------------------------------------------------------------------------

interface LFMTag { name: string; count: number }

interface LFMArtistResponse {
  artist?: {
    stats?: { listeners?: string; playcount?: string }
    tags?: { tag?: LFMTag[] }
  }
  error?: number
  message?: string
}

export async function getLastFmArtistData(
  artistName: string
): Promise<LastFmArtistData | null> {
  const apiKey = process.env.LASTFM_API_KEY
  if (!apiKey) return null

  const params = new URLSearchParams({
    method: "artist.getInfo",
    artist: artistName,
    api_key: apiKey,
    format: "json",
    autocorrect: "1",
  })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${BASE_URL}?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null

    const data: LFMArtistResponse = await res.json()
    if (data.error || !data.artist) return null

    const listeners = parseInt(data.artist.stats?.listeners ?? "0", 10)
    const playcount = parseInt(data.artist.stats?.playcount ?? "0", 10)
    const tags = (data.artist.tags?.tag ?? []).map((t) => t.name.toLowerCase())

    // Re-use Spotify's genre keyword matcher against Last.fm tags
    const mappedGenre = spotifyGenresToGenre(tags)

    return { listeners, playcount, tags, mappedGenre }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Batch lookup — chunks of 10 to stay well under rate limit
// ---------------------------------------------------------------------------

export async function batchGetLastFmData(
  artistNames: string[]
): Promise<Map<string, LastFmArtistData>> {
  const unique = [...new Set(artistNames)]
  const result = new Map<string, LastFmArtistData>()

  const CHUNK_SIZE = 10
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE)
    const results = await Promise.all(
      chunk.map(async (name) => ({ name, data: await getLastFmArtistData(name) }))
    )
    for (const { name, data } of results) {
      if (data) result.set(name, data)
    }
  }

  return result
}
