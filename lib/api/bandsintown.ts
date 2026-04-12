import type { BITArtist, BITArtistEvent } from "./types"

const BASE_URL = "https://rest.bandsintown.com"
const CACHE_TTL = 3600 // 1 hour in seconds

function getAppId(): string | null {
  const id = process.env.BANDSINTOWN_APP_ID
  if (!id || id === "your_bandsintown_app_id_here") return null
  return id
}

export async function fetchBITArtist(
  artistName: string
): Promise<BITArtist | null> {
  const appId = getAppId()
  if (!appId) return null
  const encoded = encodeURIComponent(artistName)
  const url = `${BASE_URL}/artists/${encoded}?app_id=${appId}`

  const res = await fetch(url, {
    cache: "no-store",
  })

  // Bandsintown returns 404 or { "error": "Not Found" } for unknown artists
  if (res.status === 404) return null

  const data = await res.json()
  if (data?.error) return null

  return data as BITArtist
}

export async function fetchBITArtistEvents(
  artistName: string
): Promise<BITArtistEvent[]> {
  const appId = getAppId()
  if (!appId) return []
  const encoded = encodeURIComponent(artistName)
  const url = `${BASE_URL}/artists/${encoded}/events?app_id=${appId}&date=upcoming`

  const res = await fetch(url, {
    cache: "no-store",
  })

  if (res.status === 404) return []

  const data = await res.json()
  if (!Array.isArray(data)) return []

  // Filter to Minneapolis/St. Paul area
  return (data as BITArtistEvent[]).filter((event) => {
    const city = event.venue?.city?.toLowerCase() ?? ""
    const region = event.venue?.region?.toLowerCase() ?? ""
    return (
      city.includes("minneapolis") ||
      city.includes("st. paul") ||
      city.includes("saint paul") ||
      (region === "mn" &&
        (city.includes("minneapolis") ||
          city.includes("paul") ||
          city.includes("bloomington") ||
          city.includes("eden prairie") ||
          city.includes("eagan") ||
          city.includes("burnsville") ||
          city.includes("apple valley")))
    )
  })
}
