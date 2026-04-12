/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ticketmaster.com" },
      { protocol: "https", hostname: "**.ticketm.net" },
      { protocol: "https", hostname: "photos.bandsintown.com" },
      // Acme Comedy (seatengine)
      { protocol: "https", hostname: "s3.amazonaws.com" },
      { protocol: "https", hostname: "files.seatengine.com" },
      // Hennepin Arts (Contentful)
      { protocol: "https", hostname: "images.ctfassets.net" },
      // WordPress image CDN (First Avenue and other WP sites)
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
      // Dakota Jazz Club (WordPress)
      { protocol: "https", hostname: "www.dakotacooks.com" },
      // Spotify artist images
      { protocol: "https", hostname: "i.scdn.co" },
    ],
  },
}

export default nextConfig
