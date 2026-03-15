import Link from "next/link";
import type { Metadata } from "next";
import { createDbClient } from "@/lib/db/client";
import { getPublishedArticles } from "@/lib/db/articles";
import { formatArticleDate } from "@/app/learn/format-date";

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
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Learn</h1>
      <p className="mt-3 text-base-content/50 text-lg">
        Tips and strategies for creating better social media content.
      </p>

      {articles.length === 0 ? (
        <p className="mt-12 text-base-content/40">No articles yet. Check back soon!</p>
      ) : (
        <div className="mt-12 space-y-8">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/learn/${article.slug}`}
              className="block group rounded-xl border border-base-300 p-6 hover:bg-base-200 transition-colors"
            >
              <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                {article.title}
              </h2>
              <p className="mt-2 text-base-content/60 leading-relaxed">{article.description}</p>
              <div className="mt-4 flex items-center gap-4 text-sm text-base-content/40">
                {article.published_at && (
                  <time dateTime={article.published_at}>
                    {formatArticleDate(article.published_at)}
                  </time>
                )}
                {article.tags.length > 0 && (
                  <div className="flex gap-2">
                    {article.tags.map((tag) => (
                      <span key={tag} className="bg-base-200 px-2 py-0.5 rounded-full text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
