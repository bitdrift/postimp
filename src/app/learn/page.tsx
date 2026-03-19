import Link from "next/link";
import type { Metadata } from "next";
import { createDbClient } from "@/lib/db/client";
import { getPublishedArticles } from "@/lib/db/articles";
import { ArticleCard } from "@/app/learn/article-card";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Learn - Post Imp",
  description:
    "Tips, guides, and strategies for creating better social media content. Learn how to grow your Instagram presence with AI-powered tools.",
  openGraph: {
    title: "Learn - Post Imp",
    description:
      "Tips, guides, and strategies for creating better social media content. Learn how to grow your Instagram presence with AI-powered tools.",
    type: "website",
  },
};

export default async function LearnPage() {
  const db = createDbClient();
  const articles = await getPublishedArticles(db);

  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Learn</h1>
        <Link
          href="/learn/tags"
          className="text-sm text-base-content/40 hover:text-base-content/60 transition-colors"
        >
          Browse by tag
        </Link>
      </div>
      <p className="mt-3 text-base-content/50 text-lg">
        Tips and strategies for creating better social media content.
      </p>

      {articles.length === 0 ? (
        <p className="mt-12 text-base-content/40">No articles yet. Check back soon!</p>
      ) : (
        <div className="mt-12 space-y-8">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              slug={article.slug}
              title={article.title}
              description={article.description}
              published_at={article.published_at}
              tags={article.tags}
            />
          ))}
        </div>
      )}
    </section>
  );
}
