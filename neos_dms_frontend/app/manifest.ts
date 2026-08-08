import type { MetadataRoute } from "next";

const THEME_COLOR = "#c8102e";
const BACKGROUND_COLOR = "#faf7f2";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEOS DMS",
    short_name: "NEOS",
    description:
      "Distribution management system for FMCG distributors — orders, inventory, dispatch, accounting.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    categories: ["business", "productivity", "finance"],
    lang: "en",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
