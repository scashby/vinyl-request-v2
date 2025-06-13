// next.config.ts

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
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
    ],
  },
};

export default nextConfig;
