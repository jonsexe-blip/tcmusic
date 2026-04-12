import { getAllEvents } from "@/lib/events"
import DiscoverClient from "./DiscoverClient"

export const dynamic = "force-dynamic"

export default async function DiscoverPage() {
  const allEvents = await getAllEvents()
  return <DiscoverClient allEvents={allEvents} />
}
