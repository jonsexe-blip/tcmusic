// Twin Cities Music Aggregator Types

export type Neighborhood =
  | "ne-mpls"
  | "downtown-mpls"
  | "uptown"
  | "st-paul-downtown"
  | "west-7th"
  | "dinkytown"
  | "north-loop"
  | "midway"
  | "south-mpls"
  | "seward"
  | "highland-park"
  | "suburbs"

export type Genre =
  | "rock"
  | "punk"
  | "metal"
  | "indie"
  | "folk"
  | "country"
  | "hip-hop"
  | "r&b"
  | "jazz"
  | "electronic"
  | "experimental"
  | "pop"
  | "soul"
  | "blues"
  | "classical"
  | "comedy"
  | "sports"
  | "world"
  | "theater"

export type GenreMood = "heavy" | "chill" | "dancey" | "experimental" | "all"

export type AgeRestriction = "all-ages" | "18+" | "21+"

export type VenueCapacity = "small" | "medium" | "large"

export interface Venue {
  id: string
  name: string
  neighborhood: Neighborhood
  address: string
  capacity: VenueCapacity
  imageUrl?: string
}

export interface EventPrice {
  min: number
  max: number
}

export interface Event {
  id: string
  artist: string
  venue: Venue
  date: string // ISO date string
  time: string // e.g., "8:00 PM"
  doors?: string // e.g., "7:00 PM"
  price: EventPrice | "free" | "tbd"
  ageRestriction: AgeRestriction
  genres: Genre[]
  mood: GenreMood
  ticketUrl: string
  imageUrl: string
  description: string
  popularity: number // 1-100, lower = more obscure (for discover algorithm)
  isLocalArtist: boolean
  supportingActs?: string[]
}

export interface NeighborhoodConfig {
  id: Neighborhood
  name: string
  color: string
  textColor: string
}

export interface FilterState {
  dateRange: { start: Date | null; end: Date | null }
  genres: Genre[]
  mood: GenreMood
  neighborhoods: Neighborhood[]
  venues: string[] // venue IDs
  priceRange: { min: number; max: number }
  ageRestriction: AgeRestriction | "any"
  search: string
}

// Genre to mood mapping for filtering
export const genreMoodMap: Record<Genre, GenreMood> = {
  rock: "heavy",
  punk: "heavy",
  metal: "heavy",
  indie: "chill",
  folk: "chill",
  country: "chill",
  "hip-hop": "dancey",
  "r&b": "dancey",
  jazz: "chill",
  electronic: "dancey",
  experimental: "experimental",
  pop: "dancey",
  soul: "chill",
  blues: "chill",
  classical: "chill",
  comedy: "chill",
  sports: "heavy",
  world: "chill",
  theater: "chill",
}
