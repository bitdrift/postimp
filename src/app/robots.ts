import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://postimp.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/posts/",
        "/onboarding/",
        "/account/",
        "/insights/",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
