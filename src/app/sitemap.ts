import { MetadataRoute } from "next";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://splitapp-steel.vercel.app");

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = [
    "",
    "/invoice/new",
    "/leaderboard",
    "/verify",
    "/pay/batch",
    "/analytics",
  ];

  return publicPaths.map((path) => ({
    url: `${appUrl}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
    lastModified: new Date(),
  }));
}
