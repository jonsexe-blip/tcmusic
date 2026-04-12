"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface SiteHeaderProps {
  className?: string
  showSearch?: boolean
  onSearchClick?: () => void
}

export function SiteHeader({
  className,
  showSearch = true,
  onSearchClick,
}: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border",
        className
      )}
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex flex-col leading-none">
            <span className="text-lg font-extrabold uppercase tracking-tight">
              Twin Cities
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Shows
            </span>
          </div>
        </Link>

        {/* Search button */}
        {showSearch && (
          <button
            onClick={onSearchClick}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary hover:bg-muted transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}
