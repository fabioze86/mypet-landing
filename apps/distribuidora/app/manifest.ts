import type { MetadataRoute } from "next";
import { clientConfig } from "@/client.config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: clientConfig.name,
    short_name: "Distribuidora",
    description: "Catálogo de atacado para pet shops e distribuidores",
    start_url: "/",
    display: "standalone",
    background_color: clientConfig.palette.navy,
    theme_color: clientConfig.palette.navy,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
