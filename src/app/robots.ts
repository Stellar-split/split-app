import { MetadataRoute } from "next";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://stellarsplit-dapp.vercel.app");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/settings/", "/profile/", "/dev/", "/recipient", "/pay/"] },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
