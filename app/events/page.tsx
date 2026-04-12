import { Suspense } from "react"
import { getAllEvents, getTonightEvents, getWeekendEvents } from "@/lib/events"
import EventsClient from "./EventsClient"

export const revalidate = 3600

export default async function EventsPage() {
  const [allEvents, tonightEvents, weekendEvents] = await Promise.all([
    getAllEvents(),
    getTonightEvents(),
    getWeekendEvents(),
  ])

  // Extract unique venues sorted alphabetically for the filter sheet.
  // Deduplicate by normalized name (lowercase, no punctuation) so the same
  // physical venue doesn't appear twice when TM and a scraper both cover it.
  const venueByName = new Map<string, typeof allEvents[0]["venue"]>()
  for (const event of allEvents) {
    const key = event.venue.name.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (!venueByName.has(key)) venueByName.set(key, event.venue)
  }
  const venues = [...venueByName.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  return (
    <Suspense>
      <EventsClient
        allEvents={allEvents}
        tonightEvents={tonightEvents}
        weekendEvents={weekendEvents}
        venues={venues}
      />
    </Suspense>
  )
}
