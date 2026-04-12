import Link from "next/link"
import { ArrowRight, Map, Sparkles } from "lucide-react"
import {
  events,
  getTonightEvents,
  getWeekendEvents,
  getUpcomingEvents,
} from "@/lib/data"
import { getDiscoverEvents } from "@/lib/filters"
import { EventCard } from "@/components/event-card"
import { EventGrid } from "@/components/event-grid"
import { MobileNav } from "@/components/mobile-nav"
import { SiteHeader } from "@/components/site-header"
import { neighborhoods } from "@/lib/neighborhoods"
import { getEventCountsByNeighborhood } from "@/lib/filters"

export default function HomePage() {
  const tonightEvents = getTonightEvents()
  const weekendEvents = getWeekendEvents()
  const upcomingEvents = getUpcomingEvents(8)
  const discoverEvents = getDiscoverEvents(events, 4)
  const neighborhoodCounts = getEventCountsByNeighborhood(events)

  // Get a featured event (highest popularity from upcoming)
  const featuredEvent = upcomingEvents
    .sort((a, b) => b.popularity - a.popularity)[0]

  return (
    <div className="min-h-screen pb-20">
      <SiteHeader />

      <main className="px-4 py-6 space-y-10">
        {/* Hero / Featured Event */}
        {featuredEvent && (
          <section>
            <EventCard event={featuredEvent} variant="featured" />
          </section>
        )}

        {/* Quick Actions */}
        <section className="flex gap-3">
          <Link
            href="/map"
            className="flex-1 flex items-center justify-center gap-2 h-14 bg-secondary rounded-lg border border-border hover:border-muted-foreground transition-colors"
          >
            <Map className="w-5 h-5" />
            <span className="font-bold uppercase tracking-wide text-sm">
              Map View
            </span>
          </Link>
          <Link
            href="/discover"
            className="flex-1 flex items-center justify-center gap-2 h-14 bg-secondary rounded-lg border border-border hover:border-muted-foreground transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            <span className="font-bold uppercase tracking-wide text-sm">
              Discover
            </span>
          </Link>
        </section>

        {/* Tonight */}
        {tonightEvents.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-extrabold uppercase tracking-tight">
                Tonight
              </h2>
              <Link
                href="/events?filter=tonight"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                See all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <EventGrid events={tonightEvents.slice(0, 4)} />
          </section>
        )}

        {/* This Weekend */}
        {weekendEvents.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-extrabold uppercase tracking-tight">
                This Weekend
              </h2>
              <Link
                href="/events?filter=weekend"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                See all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <EventGrid events={weekendEvents.slice(0, 6)} />
          </section>
        )}

        {/* Discover - Hidden Gems */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-extrabold uppercase tracking-tight">
                Discover
              </h2>
              <p className="text-sm text-muted-foreground">
                Shows you might not know about
              </p>
            </div>
            <Link
              href="/discover"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              More <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <EventGrid events={discoverEvents} variant="compact" />
        </section>

        {/* Neighborhoods Quick Access */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-extrabold uppercase tracking-tight">
              By Neighborhood
            </h2>
            <Link
              href="/map"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Map view <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {neighborhoods.slice(0, 6).map((hood) => (
              <Link
                key={hood.id}
                href={`/events?neighborhood=${hood.id}`}
                className="relative flex flex-col justify-end h-24 rounded-lg p-3 overflow-hidden transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: hood.color + "20" }}
              >
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: hood.color }}
                />
                <span
                  className="text-sm font-bold"
                  style={{ color: hood.color }}
                >
                  {hood.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {neighborhoodCounts[hood.id] || 0} shows
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* All Upcoming */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-extrabold uppercase tracking-tight">
              All Upcoming
            </h2>
            <Link
              href="/events"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              See all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <EventGrid events={upcomingEvents} />
        </section>
      </main>

      <MobileNav />
    </div>
  )
}
