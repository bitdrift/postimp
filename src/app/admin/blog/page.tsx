import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getArticlePage, getArticleCounts } from "@/lib/db/articles";
import { ArticleList } from "./article-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Article Dashboard - Post Imp",
  robots: { index: false, follow: false },
};

type Filter = "all" | "published" | "drafts";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; filter?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const filter: Filter =
    params.filter === "published" || params.filter === "drafts" ? params.filter : "all";

  const db = createDbClient();
  const [{ articles, nextCursor }, counts] = await Promise.all([
    getArticlePage(db, {
      cursor: params.cursor,
      filter: filter === "all" ? undefined : filter,
    }),
    getArticleCounts(db),
  ]);

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Article Dashboard</h1>
      <p className="mt-3 text-base-content/50 text-lg">
        {counts.total} article{counts.total !== 1 ? "s" : ""} total
      </p>

      <ArticleList articles={articles} nextCursor={nextCursor} filter={filter} counts={counts} />
    </section>
  );
}
