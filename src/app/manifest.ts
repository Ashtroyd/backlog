import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Backlog",
    short_name: "Backlog",
    description:
      "Your games, movies, series and anime — what's next, what's in progress, what's done.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f5",
    theme_color: "#faf9f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
