/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  async rewrites() {
    return [
      {
        source: "/api/property/:path*",
        destination: `${process.env.NEXT_PUBLIC_PROPERTY_API_URL || "http://localhost:3001/v1"}/:path*`,
      },
      {
        source: "/api/rate/:path*",
        destination: `${process.env.NEXT_PUBLIC_RATE_API_URL || "http://localhost:3002/v1"}/:path*`,
      },
      {
        source: "/api/booking/:path*",
        destination: `${process.env.NEXT_PUBLIC_BOOKING_API_URL || "http://localhost:3004/v1"}/:path*`,
      },
      {
        source: "/api/front-desk/:path*",
        destination: `${process.env.NEXT_PUBLIC_FRONT_DESK_API_URL || "http://localhost:3005/v1"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
