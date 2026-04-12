import { getAllEvents } from "@/lib/events"
import DiscoverClient from "./DiscoverClient"

export const revalidate = 3600

export default async function DiscoverPage() {
  const allEvents = await getAllEvents()
  return <DiscoverClient allEvents={allEvents} />
}
