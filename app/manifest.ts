import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Await",
    short_name: "Await",
    description: "Where connections are worth the await.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ea",
    theme_color: "#f4f2ea",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
