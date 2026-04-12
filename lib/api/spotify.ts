/**
 * Spotify Web API — artist image + genre enrichment
 *
 * Uses the Client Credentials flow (app-level auth, no user login needed).
 * Token is cached in memory for its lifetime (~1 hour) to avoid redundant
 * token fetches across the many artist lookups in a single cache cycle.
 */

import type { Genre, GenreMood } from "../types"
import { genreMoodMap } from "../types"

const TOKEN_URL = "https://accounts.spotify.com/api/token"
const SEARCH_URL = "https://api.spotify.com/v1/search"

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  })

  if (!res.ok) return null

  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + data.expires_in * 1000
  return cachedToken
}

// ---------------------------------------------------------------------------
// Spotify genre → our Genre mapping
// Each entry is a keyword to match against Spotify's genre strings.
// Order matters — more specific matches should come first.
// ---------------------------------------------------------------------------

const SPOTIFY_GENRE_KEYWORDS: { keywords: string[]; genre: Genre }[] = [
  // Experimental first (before rock/electronic to catch "experimental rock" etc.)
  { keywords: ["experimental", "avant-garde", "noise", "drone", "outsider", "weird"], genre: "experimental" },
  // Electronic / dance
  { keywords: ["edm", "house", "techno", "trance", "dubstep", "electronic", "ambient", "synth", "chillwave", "lo-fi", "vaporwave", "future bass", "drum and bass", "dnb"], genre: "electronic" },
  // Hip-hop / rap
  { keywords: ["hip hop", "hip-hop", "rap", "trap", "drill", "grime", "boom bap", "conscious hip hop"], genre: "hip-hop" },
  // R&B
  { keywords: ["r&b", "rnb", "neo soul", "new jack swing"], genre: "r&b" },
  // Soul
  { keywords: ["soul", "motown", "funk"], genre: "soul" },
  // Metal
  { keywords: ["metal", "metalcore", "deathcore", "grindcore", "thrash", "doom", "sludge", "black metal", "death metal"], genre: "metal" },
  // Punk
  { keywords: ["punk", "hardcore", "emo", "post-hardcore", "screamo", "skate punk", "pop punk"], genre: "punk" },
  // Jazz
  { keywords: ["jazz", "bebop", "swing", "bossa nova", "fusion jazz", "big band"], genre: "jazz" },
  // Blues
  { keywords: ["blues", "delta blues", "chicago blues", "texas blues"], genre: "blues" },
  // Classical
  { keywords: ["classical", "opera", "orchestra", "chamber", "symphony", "baroque", "contemporary classical", "broadway", "show tunes"], genre: "classical" },
  // Folk / Americana
  { keywords: ["folk", "americana", "bluegrass", "singer-songwriter", "acoustic", "appalachian"], genre: "folk" },
  // Country
  { keywords: ["country", "honky tonk", "outlaw country", "nashville"], genre: "country" },
  // Pop
  { keywords: ["pop", "dance pop", "electropop", "synth pop", "indie pop", "art pop", "bubblegum", "teen pop"], genre: "pop" },
  // Indie (catch-all after more specific matches)
  { keywords: ["indie", "alternative", "shoegaze", "dream pop", "slowcore", "post-rock", "math rock", "garage rock"], genre: "indie" },
  // World (before rock to catch "world music" etc.)
  { keywords: ["world", "afrobeat", "reggae", "latin", "cumbia", "salsa", "flamenco", "celtic", "klezmer", "afropop", "highlife", "soca", "calypso", "global"], genre: "world" },
  // Rock (broadest — last)
  { keywords: ["rock", "classic rock", "hard rock", "psychedelic", "grunge", "new wave", "post-punk"], genre: "rock" },
]

/**
 * Maps an array of Spotify genre strings to our Genre type.
 * Returns the best-matched genre, or null if nothing matches.
 */
export function spotifyGenresToGenre(spotifyGenres: string[]): Genre | null {
  const combined = spotifyGenres.join(" ").toLowerCase()
  for (const { keywords, genre } of SPOTIFY_GENRE_KEYWORDS) {
    if (keywords.some((kw) => combined.includes(kw))) return genre
  }
  return null
}

export function spotifyGenresToMood(spotifyGenres: string[]): GenreMood | null {
  const genre = spotifyGenresToGenre(spotifyGenres)
  if (!genre) return null
  return genreMoodMap[genre] ?? null
}

// ---------------------------------------------------------------------------
// Artist data type
// ---------------------------------------------------------------------------

export interface SpotifyArtistData {
  imageUrl: string | null
  genres: string[]           // raw Spotify genre strings
  mappedGenre: Genre | null  // our Genre type
  mood: GenreMood | null     // derived mood
}

// ---------------------------------------------------------------------------
// Single artist lookup
// ---------------------------------------------------------------------------

interface SpotifyArtist {
  id: string
  name: string
  images: { url: string; width: number; height: number }[]
  genres: string[]
  popularity: number
}

interface SpotifySearchResponse {
  artists: { items: SpotifyArtist[] }
}

export async function getSpotifyArtistData(artistName: string): Promise<SpotifyArtistData | null> {
  const token = await getAccessToken()
  if (!token) return null

  const params = new URLSearchParams({ q: artistName, type: "artist", limit: "1" })

  try {
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null

    const data: SpotifySearchResponse = await res.json()
    const artist = data.artists?.items?.[0]
    if (!artist) return null

    const sorted = [...artist.images].sort((a, b) => b.width - a.width)
    const medium = sorted.find((img) => img.width <= 640) ?? sorted[0]

    const mappedGenre = spotifyGenresToGenre(artist.genres)
    const mood = mappedGenre ? (genreMoodMap[mappedGenre] ?? null) : null

    return {
      imageUrl: medium?.url ?? null,
      genres: artist.genres,
      mappedGenre,
      mood,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Batch lookup — deduplicates by artist name, processes in chunks
// ---------------------------------------------------------------------------

export async function batchGetArtistData(
  artistNames: string[]
): Promise<Map<string, SpotifyArtistData>> {
  const unique = [...new Set(artistNames)]
  const result = new Map<string, SpotifyArtistData>()

  const CHUNK_SIZE = 10
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE)
    const results = await Promise.all(
      chunk.map(async (name) => ({ name, data: await getSpotifyArtistData(name) }))
    )
    for (const { name, data } of results) {
      if (data) result.set(name, data)
    }
  }

  return result
}

// Keep old export for backward compat
export async function batchGetArtistImages(
  artistNames: string[]
): Promise<Map<string, string>> {
  const data = await batchGetArtistData(artistNames)
  const result = new Map<string, string>()
  for (const [name, d] of data) {
    if (d.imageUrl) result.set(name, d.imageUrl)
  }
  return result
}
