// Raw Ticketmaster Discovery API v2 response types

export interface TMImage {
  ratio: string
  url: string
  width: number
  height: number
  fallback: boolean
}

export interface TMClassification {
  primary: boolean
  segment: { id: string; name: string }
  genre: { id: string; name: string }
  subGenre: { id: string; name: string }
  type?: { id: string; name: string }
  subType?: { id: string; name: string }
}

export interface TMPriceRange {
  type: string
  currency: string
  min: number
  max: number
}

export interface TMVenue {
  id: string
  name: string
  type: string
  url: string
  locale: string
  postalCode: string
  timezone: string
  city: { name: string }
  state: { name: string; stateCode: string }
  country: { name: string; countryCode: string }
  address: { line1: string; line2?: string }
  location: { longitude: string; latitude: string }
  parkingDetail?: string
  boxOfficeInfo?: { phoneNumberDetail: string; openHoursDetail: string }
  generalInfo?: { generalRule: string; childRule: string }
  upcomingEvents: { _total: number }
}

export interface TMAttraction {
  id: string
  name: string
  type: string
  url: string
  locale: string
  images: TMImage[]
  classifications: TMClassification[]
  externalLinks?: Record<string, Array<{ url: string }>>
  upcomingEvents: { _total: number }
}

export interface TMEventDate {
  start: {
    localDate: string
    localTime?: string
    dateTime?: string
    dateTBD: boolean
    dateTBA: boolean
    timeTBD: boolean
    noSpecificTime: boolean
  }
  end?: {
    localDate?: string
    localTime?: string
    dateTime?: string
    approximate?: boolean
    noSpecificTime?: boolean
  }
  timezone?: string
  status: { code: string }
  spanMultipleDays?: boolean
}

export interface TMSalesInfo {
  public: {
    startDateTime: string
    startTBD: boolean
    startTBA: boolean
    endDateTime: string
  }
}

export interface TMTicketLimit {
  info: string
}

export interface TMEvent {
  id: string
  name: string
  type: string
  url: string
  locale: string
  images: TMImage[]
  sales?: TMSalesInfo
  dates: TMEventDate
  classifications: TMClassification[]
  promoter?: { id: string; name: string; description: string }
  promoters?: Array<{ id: string; name: string; description: string }>
  info?: string
  pleaseNote?: string
  priceRanges?: TMPriceRange[]
  ticketLimit?: TMTicketLimit
  ageRestrictions?: { legalAgeEnforced: boolean }
  ticketing?: { safeTix: { enabled: boolean } }
  _links: { self: { href: string } }
  _embedded?: {
    venues: TMVenue[]
    attractions: TMAttraction[]
  }
  popularity?: number
  accessibility?: { ticketLimit?: number }
  doorsTimes?: { localDate?: string; localTime?: string; dateTime?: string }
}

export interface TMEventsResponse {
  _embedded?: { events: TMEvent[] }
  _links: {
    first?: { href: string }
    self: { href: string }
    next?: { href: string }
    last?: { href: string }
  }
  page: {
    size: number
    totalElements: number
    totalPages: number
    number: number
  }
}

// Raw Bandsintown API response types

export interface BITOffer {
  type: string
  url: string
  status: string
}

export interface BITVenue {
  name: string
  latitude: string
  longitude: string
  city: string
  region: string
  country: string
}

export interface BITArtistEvent {
  id: string
  artist_id: string
  url: string
  on_sale_datetime: string
  datetime: string
  description?: string
  venue: BITVenue
  lineup: string[]
  offers: BITOffer[]
  artist?: BITArtist
}

export interface BITArtist {
  id: string
  name: string
  url: string
  image_url: string
  thumb_url: string
  facebook_page_url?: string
  mbid?: string
  tracker_count: number
  upcoming_event_count: number
}
