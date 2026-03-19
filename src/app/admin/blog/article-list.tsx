import Link from "next/link";
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
  return (
    <>
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
            <Link
              key={article.id}
              href={
                article.published
                  ? `/learn/${article.slug}`
                  : `/admin/blog/write?article=${article.id}`
              }
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
                  <p className="mt-1 text-sm text-base-content/50 truncate">
                    {article.description}
                  </p>
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
