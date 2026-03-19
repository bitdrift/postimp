"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MarketingArticle } from "@/lib/db/articles";
import { formatArticleDate } from "@/app/learn/format-date";

type Filter = "all" | "published" | "drafts";

interface Props {
  articles: Omit<MarketingArticle, "content">[];
  nextCursor: string | null;
  filter: Filter;
  counts: { total: number; published: number; drafts: number };
}

function filterHref(filter: Filter): string {
  if (filter === "all") return "/admin/blog";
  return `/admin/blog?filter=${filter}`;
}

function nextHref(filter: Filter, cursor: string): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  params.set("cursor", cursor);
  return `/admin/blog?${params.toString()}`;
}

export function ArticleList({ articles, nextCursor, filter, counts }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dismissDelete = useCallback(() => setConfirmDelete(null), []);

  useEffect(() => {
    if (!confirmDelete) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismissDelete();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmDelete, dismissDelete]);

  async function handleDelete(id: string) {
    setLoading(id);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete article");
      setConfirmDelete(null);
      router.refresh();
    } catch {
      setError("Failed to delete article. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleUnpublish(id: string) {
    setLoading(id);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false, published_at: null }),
      });
      if (!res.ok) throw new Error("Failed to unpublish article");
      router.refresh();
    } catch {
      setError("Failed to unpublish article. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const deleteTarget = confirmDelete ? articles.find((a) => a.id === confirmDelete) : null;

  return (
    <>
      {error && (
        <div className="mt-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          {error}
          <button onClick={() => setError(null)} className="ml-3 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-8 flex gap-2">
        <FilterButton href={filterHref("all")} active={filter === "all"}>
          All ({counts.total})
        </FilterButton>
        <FilterButton href={filterHref("published")} active={filter === "published"}>
          Published ({counts.published})
        </FilterButton>
        <FilterButton href={filterHref("drafts")} active={filter === "drafts"}>
          Drafts ({counts.drafts})
        </FilterButton>
      </div>

      {articles.length === 0 ? (
        <p className="mt-12 text-base-content/40">No articles match this filter.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {articles.map((article) => (
            <div
              key={article.id}
              className="group rounded-xl border border-base-300 p-5 hover:bg-base-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <Link
                  href={
                    article.published
                      ? `/learn/${article.slug}`
                      : `/admin/blog/write?article=${article.id}`
                  }
                  className="min-w-0 flex-1"
                >
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
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {article.published && (
                    <button
                      onClick={() => handleUnpublish(article.id)}
                      disabled={loading === article.id}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-warning bg-warning/10 hover:bg-warning/20 transition-colors disabled:opacity-50"
                      title="Unpublish"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(article.id)}
                    disabled={loading === article.id}
                    className="rounded-lg p-1.5 text-base-content/30 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                    title="Delete article"
                  >
                    <TrashIcon />
                  </button>
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
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="mt-8 flex justify-end">
          <Link
            href={nextHref(filter, nextCursor)}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-content text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            Next page
          </Link>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={dismissDelete}
          onKeyDown={() => {}}
          role="presentation"
        >
          <div
            className="rounded-xl border border-base-300 bg-base-100 p-6 shadow-xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={() => {}}
            role="presentation"
          >
            <h3 className="text-lg font-semibold">Delete article?</h3>
            <p className="mt-2 text-sm text-base-content/60">
              Are you sure you want to delete{" "}
              <span className="font-medium text-base-content">
                {deleteTarget?.title ?? "this article"}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={dismissDelete}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-base-200 hover:bg-base-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={loading === confirmDelete}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-error text-error-content hover:bg-error/80 transition-colors disabled:opacity-50"
              >
                {loading === confirmDelete ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-content"
          : "bg-base-200 text-base-content/60 hover:bg-base-300"
      }`}
    >
      {children}
    </Link>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4.5 w-4.5"
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}
