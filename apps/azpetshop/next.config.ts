import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "imagedelivery.net" }],
  },
};

export default nextConfig;
