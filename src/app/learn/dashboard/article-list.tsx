"use client";

import { useState } from "react";
import Link from "next/link";
import type { MarketingArticle } from "@/lib/db/articles";
import { formatArticleDate } from "@/app/learn/format-date";

type Filter = "all" | "published" | "drafts";

interface Props {
  articles: Omit<MarketingArticle, "content">[];
}

export function ArticleList({ articles }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = articles.filter((a) => {
    if (filter === "published") return a.published;
    if (filter === "drafts") return !a.published;
    return true;
  });

  const publishedCount = articles.filter((a) => a.published).length;
  const draftCount = articles.length - publishedCount;

  return (
    <>
      <div className="mt-8 flex gap-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          All ({articles.length})
        </FilterButton>
        <FilterButton active={filter === "published"} onClick={() => setFilter("published")}>
          Published ({publishedCount})
        </FilterButton>
        <FilterButton active={filter === "drafts"} onClick={() => setFilter("drafts")}>
          Drafts ({draftCount})
        </FilterButton>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-12 text-base-content/40">No articles match this filter.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {filtered.map((article) => (
            <Link
              key={article.id}
              href={article.published ? `/learn/${article.slug}` : `/learn/write?article=${article.id}`}
              className="block group rounded-xl border border-base-300 p-5 hover:bg-base-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold group-hover:text-primary transition-colors truncate">
                      {article.title}
                    </h2>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        article.published
                          ? "bg-success/20 text-success"
                          : "bg-warning/20 text-warning"
                      }`}
                    >
                      {article.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-base-content/50 truncate">{article.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-base-content/40">
                <time dateTime={article.published_at ?? article.created_at}>
                  {formatArticleDate(article.published_at ?? article.created_at)}
                </time>
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
    </>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/60 hover:bg-base-300"
      }`}
    >
      {children}
    </button>
  );
}
