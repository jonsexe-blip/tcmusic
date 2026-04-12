import type { Neighborhood, NeighborhoodConfig } from "./types"

export const neighborhoods: NeighborhoodConfig[] = [
  {
    id: "ne-mpls",
    name: "NE Minneapolis",
    color: "#3B82F6", // Electric Blue
    textColor: "#ffffff",
  },
  {
    id: "downtown-mpls",
    name: "Downtown MPLS",
    color: "#A855F7", // Purple
    textColor: "#ffffff",
  },
  {
    id: "uptown",
    name: "Uptown",
    color: "#EC4899", // Hot Pink
    textColor: "#ffffff",
  },
  {
    id: "st-paul-downtown",
    name: "St Paul Downtown",
    color: "#F97316", // Burnt Orange
    textColor: "#ffffff",
  },
  {
    id: "west-7th",
    name: "West 7th",
    color: "#F59E0B", // Amber
    textColor: "#000000",
  },
  {
    id: "dinkytown",
    name: "Dinkytown",
    color: "#84CC16", // Lime
    textColor: "#000000",
  },
  {
    id: "north-loop",
    name: "North Loop",
    color: "#06B6D4", // Cyan
    textColor: "#000000",
  },
  {
    id: "midway",
    name: "Midway",
    color: "#EF4444", // Red
    textColor: "#ffffff",
  },
  {
    id: "south-mpls",
    name: "South Minneapolis",
    color: "#10B981", // Emerald
    textColor: "#ffffff",
  },
  {
    id: "seward",
    name: "Seward",
    color: "#8B5CF6", // Violet
    textColor: "#ffffff",
  },
  {
    id: "highland-park",
    name: "Highland Park",
    color: "#14B8A6", // Teal
    textColor: "#ffffff",
  },
  {
    id: "suburbs",
    name: "Suburbs",
    color: "#64748B", // Slate
    textColor: "#ffffff",
  },
]

export function getNeighborhoodConfig(id: Neighborhood): NeighborhoodConfig {
  return neighborhoods.find((n) => n.id === id) || neighborhoods[0]
}

export function getNeighborhoodColor(id: Neighborhood): string {
  return getNeighborhoodConfig(id).color
}

export function getNeighborhoodName(id: Neighborhood): string {
  return getNeighborhoodConfig(id).name
}
