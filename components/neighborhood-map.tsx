"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { neighborhoods } from "@/lib/neighborhoods"
import type { Neighborhood } from "@/lib/types"
import { cn } from "@/lib/utils"

interface NeighborhoodMapProps {
  eventCounts: Record<Neighborhood, number>
  className?: string
}

// Stylized map layout positions (approximate relative positions)
const mapPositions: Record<
  Neighborhood,
  { gridArea: string; label: string }
> = {
  "north-loop": { gridArea: "1 / 2 / 2 / 3", label: "North Loop" },
  "ne-mpls": { gridArea: "1 / 3 / 2 / 4", label: "NE" },
  "downtown-mpls": { gridArea: "2 / 2 / 3 / 3", label: "Downtown" },
  "dinkytown": { gridArea: "2 / 3 / 3 / 4", label: "Dinkytown" },
  "uptown": { gridArea: "3 / 1 / 4 / 2", label: "Uptown" },
  "seward": { gridArea: "3 / 2 / 4 / 3", label: "Seward" },
  "south-mpls": { gridArea: "4 / 1 / 5 / 3", label: "South MPLS" },
  "midway": { gridArea: "2 / 4 / 3 / 5", label: "Midway" },
  "st-paul-downtown": { gridArea: "3 / 4 / 4 / 5", label: "St Paul" },
  "west-7th": { gridArea: "4 / 4 / 5 / 5", label: "West 7th" },
  "highland-park": { gridArea: "4 / 3 / 5 / 4", label: "Highland" },
  "suburbs": { gridArea: "5 / 1 / 6 / 5", label: "Greater Metro" },
}

export function NeighborhoodMap({
  eventCounts,
  className,
}: NeighborhoodMapProps) {
  const router = useRouter()
  const [hoveredHood, setHoveredHood] = useState<Neighborhood | null>(null)

  const handleClick = (neighborhood: Neighborhood) => {
    router.push(`/events?neighborhood=${neighborhood}`)
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Map Grid */}
      <div
        className="grid gap-2 aspect-square max-w-md mx-auto"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(5, 1fr)",
        }}
      >
        {neighborhoods.map((hood) => {
          const position = mapPositions[hood.id]
          const count = eventCounts[hood.id] || 0
          const isHovered = hoveredHood === hood.id

          return (
            <button
              key={hood.id}
              onClick={() => handleClick(hood.id)}
              onMouseEnter={() => setHoveredHood(hood.id)}
              onMouseLeave={() => setHoveredHood(null)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg",
                "transition-all duration-200 ease-out",
                "border-2",
                isHovered ? "scale-105 z-10" : "scale-100"
              )}
              style={{
                gridArea: position.gridArea,
                backgroundColor: isHovered ? hood.color : hood.color + "30",
                borderColor: hood.color,
              }}
            >
              <span
                className={cn(
                  "text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors text-center px-1",
                  isHovered ? "text-white" : ""
                )}
                style={{ color: isHovered ? hood.textColor : hood.color }}
              >
                {position.label}
              </span>
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-medium transition-colors",
                  isHovered ? "text-white/80" : "text-muted-foreground"
                )}
              >
                {count} show{count !== 1 ? "s" : ""}
              </span>
            </button>
          )
        })}
      </div>

      {/* Mississippi River indicator */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className="h-px w-8 bg-blue-500/30" />
        <span>Mississippi River divides MPLS & St Paul</span>
        <div className="h-px w-8 bg-blue-500/30" />
      </div>
    </div>
  )
}

// Legend component
export function NeighborhoodLegend() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {neighborhoods.map((hood) => (
        <div key={hood.id} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: hood.color }}
          />
          <span className="text-xs text-muted-foreground truncate">
            {hood.name}
          </span>
        </div>
      ))}
    </div>
  )
}
