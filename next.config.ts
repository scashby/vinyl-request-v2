// next.config.ts

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Existing patterns
      {
        protocol: 'https',
        hostname: 'img.discogs.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'bntoivaipesuovselglg.supabase.co',
        pathname: '/storage/v1/object/public/event-images/**',
      },
      {
        protocol: 'https',
        hostname: 'bntoivaipesuovselglg.supabase.co',
        pathname: '/storage/v1/object/public/album-art/**',
      },
      // Spotify CDN for album covers
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        pathname: '/image/**',
      },
      // Apple Music CDN for album covers
      {
        protocol: 'https',
        hostname: 'is1-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is2-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is3-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is4-ssl.mzstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'is5-ssl.mzstatic.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;