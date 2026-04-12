import type { Metadata, Viewport } from 'next'
import { Inter_Tight } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const interTight = Inter_Tight({ 
  subsets: ["latin"],
  variable: '--font-inter-tight',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Twin Cities Shows | Local Music Aggregator',
  description: 'Discover live music across Minneapolis and St Paul. Find shows by neighborhood, genre, and mood. Your guide to the Twin Cities music scene.',
  keywords: ['Twin Cities', 'Minneapolis', 'St Paul', 'live music', 'concerts', 'shows', 'local music'],
  openGraph: {
    title: 'Twin Cities Shows',
    description: 'Your guide to the Twin Cities music scene',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={interTight.variable}>
      <body className="font-sans min-h-screen bg-background text-foreground">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
