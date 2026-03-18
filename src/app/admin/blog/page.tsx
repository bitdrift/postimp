import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@/lib/db/client";
import { getAllArticles } from "@/lib/db/articles";
import { ArticleList } from "./article-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Article Dashboard - Post Imp",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const db = createDbClient();
  const articles = await getAllArticles(db);

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Article Dashboard</h1>
      <p className="mt-3 text-base-content/50 text-lg">
        {articles.length} article{articles.length !== 1 ? "s" : ""} total
      </p>

      <ArticleList articles={articles} />
    </section>
  );
}
