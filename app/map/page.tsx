import { getAllEvents } from "@/lib/events"
import MapClient from "./MapClient"

export const dynamic = "force-dynamic"

export default async function MapPage() {
  const allEvents = await getAllEvents()
  return <MapClient allEvents={allEvents} />
}
