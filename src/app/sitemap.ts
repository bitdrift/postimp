import type { MetadataRoute } from "next";
import { createDbClient } from "@/lib/db/client";
import { getPublishedArticles } from "@/lib/db/articles";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://postimp.com";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    {
      url: `${baseUrl}/learn`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    { url: `${baseUrl}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const db = createDbClient();
  const articles = await getPublishedArticles(db);

  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${baseUrl}/learn/${article.slug}`,
    lastModified: article.published_at ? new Date(article.published_at) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const uniqueTags = new Set<string>();
  for (const article of articles) {
    for (const tag of article.tags) {
      uniqueTags.add(tag);
    }
  }

  const tagPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/learn/tags`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    },
    ...[...uniqueTags].map((tag) => ({
      url: `${baseUrl}/learn/tags/${encodeURIComponent(tag)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];

  return [...staticPages, ...articlePages, ...tagPages];
}
