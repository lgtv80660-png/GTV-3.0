import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.GTV_LOCAL_RUNTIME === '1' ? (process.env.GTV_LOGIN_FIX_BUILD === '1' ? '.next-login-fix' : '.next-local') : '.next', experimental: { cpus: 1 }, logging: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
