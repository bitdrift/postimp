import Link from "next/link";
import type { Metadata } from "next";
import { createDbClient } from "@/lib/db/client";
import { getPublishedArticles } from "@/lib/db/articles";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Tags - Post Imp",
  description: "Browse Post Imp blog articles by topic.",
};

export default async function TagsPage() {
  const db = createDbClient();
  const articles = await getPublishedArticles(db);

  const tagCounts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

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

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Tags</h1>
      <p className="mt-3 text-base-content/50 text-lg">Browse articles by topic.</p>

      {sortedTags.length === 0 ? (
        <p className="mt-12 text-base-content/40">No tags yet.</p>
      ) : (
        <div className="mt-12 flex flex-wrap gap-3">
          {sortedTags.map(([tag, count]) => (
            <Link
              key={tag}
              href={`/learn/tags/${encodeURIComponent(tag)}`}
              className="bg-base-200 hover:bg-base-300 px-4 py-2 rounded-full text-sm transition-colors"
            >
              {tag} <span className="text-base-content/40">({count})</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
