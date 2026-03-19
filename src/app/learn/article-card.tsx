import Link from "next/link";
import { formatArticleDate } from "@/app/learn/format-date";

interface ArticleCardProps {
  slug: string;
  title: string;
  description: string;
  published_at: string | null;
  tags: string[];
}

export function ArticleCard({ slug, title, description, published_at, tags }: ArticleCardProps) {
  return (
    <div className="relative group rounded-xl border border-base-300 p-6 hover:bg-base-200 transition-colors">
      <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
        <Link href={`/learn/${slug}`} className="after:absolute after:inset-0">
          {title}
        </Link>
      </h2>
      <p className="mt-2 text-base-content/60 leading-relaxed">{description}</p>
      <div className="mt-4 flex items-center gap-4 text-sm text-base-content/40">
        {published_at && <time dateTime={published_at}>{formatArticleDate(published_at)}</time>}
        {tags.length > 0 && (
          <div className="relative z-10 flex gap-2">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/learn/tags/${encodeURIComponent(tag)}`}
                className="bg-base-200 hover:bg-base-300 px-2 py-0.5 rounded-full text-xs transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
