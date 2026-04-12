import { getAllEvents } from "@/lib/events"
import MapClient from "./MapClient"

export const revalidate = 3600

export default async function MapPage() {
  const allEvents = await getAllEvents()
  return <MapClient allEvents={allEvents} />
}
