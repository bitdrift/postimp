import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createDbClient } from "@/lib/db/client";
import { getPublishedArticlesByTag } from "@/lib/db/articles";
import { ArticleCard } from "@/app/learn/article-card";

export const revalidate = 300;

type Props = {
  params: Promise<{ tag: string }>;
};

const getCachedArticlesByTag = cache(async (tag: string) => {
  const db = createDbClient();
  return getPublishedArticlesByTag(db, tag);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const articles = await getCachedArticlesByTag(decodedTag);

  if (articles.length === 0) {
    return { title: "Tag Not Found - Post Imp" };
  }

  return {
    title: `Articles tagged "${decodedTag}" - Post Imp`,
    description: `Browse Post Imp articles about ${decodedTag}.`,
  };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const articles = await getCachedArticlesByTag(decodedTag);

  if (articles.length === 0) {
    notFound();
  }

  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <nav className="mb-8">
        <Link
          href="/learn"
          className="text-sm text-base-content/40 hover:text-base-content/60 transition-colors"
        >
          &larr; Back to Learn
        </Link>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        Articles tagged: {decodedTag}
      </h1>

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
    </section>
  );
}
