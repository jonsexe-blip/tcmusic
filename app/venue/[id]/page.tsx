import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MapPin, Users } from "lucide-react"
import { getVenueById, getEventsByVenue } from "@/lib/events"
import { getNeighborhoodConfig } from "@/lib/neighborhoods"
import { NeighborhoodBadge } from "@/components/neighborhood-badge"
import { EventCard } from "@/components/event-card"
import { MobileNav } from "@/components/mobile-nav"

export const revalidate = 3600

interface VenuePageProps {
  params: Promise<{ id: string }>
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { id } = await params
  const [venue, venueEvents] = await Promise.all([
    getVenueById(id),
    getEventsByVenue(id),
  ])

  if (!venue) {
    notFound()
  }

  const neighborhoodConfig = getNeighborhoodConfig(venue.neighborhood)
  const upcomingEvents = venueEvents
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date))

  const capacityLabels = {
    small: "Intimate",
    medium: "Medium",
    large: "Large",
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div
        className="relative h-48 bg-gradient-to-b from-secondary to-background"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(10,10,10,0.3) 0%, rgba(10,10,10,1) 100%)`,
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

        {/* Venue name */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <NeighborhoodBadge
            neighborhood={venue.neighborhood}
            size="sm"
            className="mb-2"
          />
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            {venue.name}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Venue Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground" />
            <span className="text-muted-foreground">{venue.address}</span>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {capacityLabels[venue.capacity]} venue
            </span>
          </div>
        </div>

        {/* Upcoming Shows */}
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tight mb-4">
            Upcoming Shows ({upcomingEvents.length})
          </h2>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} variant="compact" />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No upcoming shows scheduled
            </p>
          )}
        </div>
      </div>

      <MobileNav />
    </div>
  )
}
