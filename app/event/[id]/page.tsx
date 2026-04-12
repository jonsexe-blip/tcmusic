import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ExternalLink,
} from "lucide-react"
import { getEventById, getEventsByVenue, getAllEvents } from "@/lib/events"
import { getRecentSetlist } from "@/lib/api/setlistfm"
import { getNeighborhoodConfig } from "@/lib/neighborhoods"
import { NeighborhoodBadge } from "@/components/neighborhood-badge"
import { GenreTag } from "@/components/genre-tag"
import { PriceDisplay } from "@/components/price-display"
import { AgeBadge } from "@/components/age-badge"
import { EventCard } from "@/components/event-card"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { ShareButton } from "@/components/share-button"

export const dynamic = "force-dynamic"

interface EventPageProps {
  params: Promise<{ id: string }>
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params
  const event = await getEventById(id)

  if (!event) {
    notFound()
  }

  const neighborhoodConfig = getNeighborhoodConfig(event.venue.neighborhood)

  // Format date
  const eventDate = new Date(event.date + "T00:00:00")
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  // Get more shows at this venue (excluding current)
  const [venueEvents, allEvents, recentSetlist] = await Promise.all([
    getEventsByVenue(event.venue.id),
    getAllEvents(),
    getRecentSetlist(event.artist, event.venue.name),
  ])

  const moreAtVenue = venueEvents
    .filter((e) => e.id !== event.id)
    .slice(0, 4)

  // Get similar shows (same genre, different venue)
  const similarShows = allEvents
    .filter(
      (e) =>
        e.id !== event.id &&
        e.venue.id !== event.venue.id &&
        e.genres.some((g) => event.genres.includes(g))
    )
    .slice(0, 4)

  const hasImage = event.imageUrl && event.imageUrl !== "/placeholder-event.jpg"
  const color = neighborhoodConfig.color

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Image */}
      <div
        className="relative aspect-[4/3] sm:aspect-[2/1] lg:aspect-[3/1]"
        style={hasImage ? {
          backgroundImage: `linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.8) 70%, rgba(10,10,10,1) 100%), url(${event.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : {
          backgroundImage: `linear-gradient(135deg, ${color}40 0%, ${color}10 50%, rgba(10,10,10,0.9) 100%), linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.8) 70%, rgba(10,10,10,1) 100%)`,
          backgroundColor: "#0a0a0a",
        }}
      >
        {/* Neighborhood color accent */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: neighborhoodConfig.color }}
        />

        {/* Back button */}
        <Link
          href="/events"
          className="absolute top-4 left-4 flex items-center justify-center w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* Share button */}
        <ShareButton
          title={event.artist}
          text={`${event.artist} at ${event.venue.name} on ${formattedDate}`}
          url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/event/${event.id}`}
        />

        {/* Artist name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <NeighborhoodBadge
            neighborhood={event.venue.neighborhood}
            size="sm"
            className="mb-3"
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight leading-none">
            {event.artist}
          </h1>
          {event.supportingActs && event.supportingActs.length > 0 && (
            <p className="text-lg text-muted-foreground mt-2">
              with {event.supportingActs.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-8">
        {/* Key Info */}
        <div className="space-y-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">{formattedDate}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                {event.doors && <span>Doors {event.doors}</span>}
                {event.doors && <span>·</span>}
                <span>Show {event.time}</span>
              </div>
            </div>
          </div>

          {/* Venue */}
          <Link
            href={`/venue/${event.venue.id}`}
            className="flex items-start gap-3 group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold group-hover:text-accent transition-colors">
                {event.venue.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {event.venue.address}
              </p>
            </div>
          </Link>

          {/* Price & Age */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-3">
              <PriceDisplay price={event.price} size="lg" />
              <AgeBadge age={event.ageRestriction} size="md" />
            </div>
          </div>
        </div>

        {/* Get Tickets CTA */}
        <Button
          asChild
          size="lg"
          className="w-full h-14 text-base font-bold uppercase tracking-wide gap-2"
        >
          <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
            Get Tickets
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>

        {/* Genres */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
            Genres
          </h2>
          <div className="flex flex-wrap gap-2">
            {event.genres.map((genre) => (
              <GenreTag key={genre} genre={genre} size="md" />
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
            About
          </h2>
          <p className="text-foreground leading-relaxed">{event.description}</p>
        </div>

        {/* Recent Setlist */}
        {recentSetlist && recentSetlist.songs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Recent Setlist
              </h2>
              <a
                href={recentSetlist.setlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                via setlist.fm
              </a>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {recentSetlist.venueName} · {recentSetlist.cityName} ·{" "}
              {(() => {
                // API returns "dd-MM-yyyy"
                const [d, m, y] = recentSetlist.eventDate.split("-")
                return new Date(`${y}-${m}-${d}`).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })
              })()}
              {recentSetlist.tourName && ` · ${recentSetlist.tourName}`}
            </p>
            <ol className="space-y-1">
              {recentSetlist.songs.map((song, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground/50 w-5 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <span className="text-sm">
                    {song.name}
                    {song.cover && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({song.cover.name} cover)
                      </span>
                    )}
                    {song.info && (
                      <span className="text-xs text-muted-foreground ml-1 italic">
                        {song.info}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* More at this venue */}
        {moreAtVenue.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold uppercase tracking-tight">
                More at {event.venue.name}
              </h2>
              <Link
                href={`/venue/${event.venue.id}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                See all
              </Link>
            </div>
            <div className="space-y-2">
              {moreAtVenue.map((e) => (
                <EventCard key={e.id} event={e} variant="compact" />
              ))}
            </div>
          </div>
        )}

        {/* Similar Shows */}
        {similarShows.length > 0 && (
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight mb-4">
              Similar Shows
            </h2>
            <div className="space-y-2">
              {similarShows.map((e) => (
                <EventCard key={e.id} event={e} variant="compact" />
              ))}
            </div>
          </div>
        )}
      </div>

      <MobileNav />
    </div>
  )
}
