import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@mypet/core"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "imagedelivery.net" },
      // picsum: placeholder temporário do hero, remover quando a foto real do CD entrar
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
