import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The marketing assets ship pre-sized in /public, so Next's optimizer is
    // not needed and would otherwise require a configured loader at runtime.
    unoptimized: true,
  },
};

export default nextConfig;
