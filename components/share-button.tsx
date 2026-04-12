"use client"

import { useState } from "react"
import { Share2, Check } from "lucide-react"

interface ShareButtonProps {
  title: string
  text: string
  url: string
}

export function ShareButton({ title, text, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
      } catch {
        // User dismissed — do nothing
      }
      return
    }

    // Fallback: copy URL to clipboard
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
      aria-label="Share"
    >
      {copied
        ? <Check className="w-5 h-5 text-green-500" />
        : <Share2 className="w-5 h-5" />
      }
    </button>
  )
}
