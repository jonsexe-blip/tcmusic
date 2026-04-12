import Link from "next/link"
import { ArrowRight, Map as MapIcon } from "lucide-react"
import {
  getTonightEvents,
  getNext3DaysEvents,
  getAllEvents,
} from "@/lib/events"
import { getEventCountsByNeighborhood } from "@/lib/filters"
import { EventGrid } from "@/components/event-grid"
import { EventCalendar } from "@/components/event-calendar"
import { MobileNav } from "@/components/mobile-nav"
import { SiteHeader } from "@/components/site-header"
import { neighborhoods } from "@/lib/neighborhoods"

export default async function HomePage() {
  const [allEvents, tonightEvents, next3DaysEvents] = await Promise.all([
    getAllEvents(),
    getTonightEvents(),
    getNext3DaysEvents(),
  ])

  const neighborhoodCounts = getEventCountsByNeighborhood(allEvents)

  return (
    <div className="min-h-screen pb-20">
      <SiteHeader />

      <main className="px-4 py-6">
        {/* Quick Actions */}
        <section className="flex gap-3 mb-8">
          <Link
            href="/map"
            className="flex-1 flex items-center justify-center gap-2 h-14 bg-secondary rounded-lg border border-border hover:border-muted-foreground transition-colors"
          >
            <MapIcon className="w-5 h-5" />
            <span className="font-bold uppercase tracking-wide text-sm">
              Map View
            </span>
          </Link>
          <Link
            href="/events"
            className="flex-1 flex items-center justify-center gap-2 h-14 bg-secondary rounded-lg border border-border hover:border-muted-foreground transition-colors"
          >
            <span className="font-bold uppercase tracking-wide text-sm">
              All Shows
            </span>
          </Link>
        </section>

        {/* Two-column layout: events left, calendar right */}
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-8 lg:items-start">
          {/* Left: event sections */}
          <div className="space-y-10">
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
                <EventGrid events={tonightEvents.slice(0, 4)} columns={4} />
              </section>
            )}

            {/* Next 3 Days — excludes today when Tonight section is shown */}
            {(() => {
              const today = new Date().toISOString().split("T")[0]
              const events = tonightEvents.length > 0
                ? next3DaysEvents.filter((e) => e.date !== today)
                : next3DaysEvents
              return events.length > 0 ? (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-extrabold uppercase tracking-tight">
                      Next 3 Days
                    </h2>
                    <Link
                      href="/events"
                      className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      See all <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <EventGrid events={events} variant="compact" />
                </section>
              ) : null
            })()}

            {/* By Neighborhood */}
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
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {neighborhoods.map((hood) => (
                  <Link
                    key={hood.id}
                    href={`/events?neighborhood=${hood.id}`}
                    className="relative flex flex-col justify-end h-20 rounded-lg p-2.5 overflow-hidden transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: hood.color + "20" }}
                  >
                    <div
                      className="absolute top-0 left-0 w-1 h-full"
                      style={{ backgroundColor: hood.color }}
                    />
                    <span
                      className="text-xs font-bold leading-tight"
                      style={{ color: hood.color }}
                    >
                      {hood.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {neighborhoodCounts[hood.id] || 0} shows
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Right: sticky calendar sidebar */}
          <div className="hidden lg:block lg:sticky lg:top-[72px]">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Browse by Date
            </p>
            <EventCalendar events={allEvents} />
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  )
}
