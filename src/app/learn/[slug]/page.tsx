import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Markdown from "react-markdown";
import { createDbClient } from "@/lib/db/client";
import { getArticleBySlug } from "@/lib/db/articles";
import { formatArticleDate } from "@/app/learn/format-date";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
};

const getCachedArticle = cache(async (slug: string) => {
  const db = createDbClient();
  return getArticleBySlug(db, slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getCachedArticle(slug);

  if (!article) {
    return { title: "Article Not Found - Post Imp" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://postimp.com";
  const ogTitle = article.og_title || article.title;
  const ogDescription = article.og_description || article.description;

  return {
    title: `${article.title} - Post Imp`,
    description: article.description,
    authors: [{ name: article.author }],
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "article",
      publishedTime: article.published_at || undefined,
      authors: [article.author],
      tags: article.tags,
      ...(article.og_image_url && {
        images: [{ url: article.og_image_url }],
      }),
    },
    twitter: {
      card: article.og_image_url ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      ...(article.og_image_url && { images: [article.og_image_url] }),
    },
    ...(article.canonical_url && {
      alternates: { canonical: article.canonical_url },
    }),
    ...(!article.canonical_url && {
      alternates: { canonical: `${baseUrl}/learn/${article.slug}` },
    }),
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getCachedArticle(slug);

  if (!article) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: {
      "@type": "Organization",
      name: article.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Post Imp",
    },
    ...(article.og_image_url && { image: article.og_image_url }),
  };

  return (
    <section className="max-w-2xl mx-auto px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-8">
        <Link
          href="/learn"
          className="text-sm text-base-content/40 hover:text-base-content/60 transition-colors"
        >
          &larr; Back to Learn
        </Link>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{article.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-base-content/40">
          <span>{article.author}</span>
          {article.published_at && (
            <time dateTime={article.published_at}>{formatArticleDate(article.published_at)}</time>
          )}
        </div>
        {article.tags.length > 0 && (
          <div className="mt-3 flex gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="bg-base-200 text-base-content/60 px-2.5 py-0.5 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <article className="prose max-w-none">
        <Markdown>{article.content}</Markdown>
      </article>
    </section>
  );
}
