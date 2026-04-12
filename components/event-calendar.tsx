"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import type { Event } from "@/lib/types"
import { cn } from "@/lib/utils"

interface EventCalendarProps {
  events: Event[]
  /** If provided, clicking a date calls this instead of navigating */
  onDateSelect?: (date: string) => void
  selectedDate?: string
  className?: string
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

export function EventCalendar({
  events,
  onDateSelect,
  selectedDate,
  className,
}: EventCalendarProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Build a map of date string → event count
  const eventsByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events) {
      map.set(e.date, (map.get(e.date) ?? 0) + 1)
    }
    return map
  }, [events])

  // Calendar grid — pad start and end to fill full weeks
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: { date: number; current: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: daysInPrevMonth - i, current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: d, current: true })
  }
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: d, current: false })
    }
  }

  const todayStr = today.toISOString().split("T")[0]

  function toDateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold uppercase tracking-wide">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {cells.map((cell, i) => {
          if (!cell.current) {
            return (
              <div key={i} className="bg-background aspect-square flex flex-col items-center justify-center p-1">
                <span className="text-xs text-muted-foreground/30">{cell.date}</span>
              </div>
            )
          }

          const dateStr = toDateStr(cell.date)
          const count = eventsByDate.get(dateStr) ?? 0
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const hasEvents = count > 0

          const inner = (
            <div
              className={cn(
                "w-full aspect-square flex flex-col items-center justify-center gap-0.5 p-1 transition-colors",
                isSelected
                  ? "bg-foreground text-background"
                  : isToday
                  ? "bg-secondary"
                  : hasEvents
                  ? "hover:bg-secondary cursor-pointer"
                  : "cursor-default"
              )}
            >
              <span className={cn(
                "text-xs font-semibold leading-none",
                !hasEvents && !isToday && "text-muted-foreground/50",
                isSelected && "text-background",
              )}>
                {cell.date}
              </span>
              {hasEvents && (
                <span className={cn(
                  "text-[9px] font-bold leading-none",
                  isSelected ? "text-background/70" : "text-primary"
                )}>
                  {count}
                </span>
              )}
            </div>
          )

          if (!hasEvents) return <div key={i} className="bg-background">{inner}</div>

          if (onDateSelect) {
            return (
              <div key={i} className="bg-background" onClick={() => onDateSelect(dateStr)}>
                {inner}
              </div>
            )
          }

          return (
            <Link key={i} href={`/events?date=${dateStr}`} className="bg-background">
              {inner}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
