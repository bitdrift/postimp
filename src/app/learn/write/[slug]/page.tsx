import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArticleBySlugWithDrafts } from "@/lib/db/articles";
import WriteArticleClient from "../write-article-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WriteArticleBySlugPage({ params }: Props) {
  const { slug } = await params;
  const db = createAdminClient();
  const article = await getArticleBySlugWithDrafts(db, slug);

  if (!article) {
    notFound();
  }

  return (
    <WriteArticleClient
      initialArticle={{
        id: article.id,
        title: article.title,
        slug: article.slug,
        description: article.description,
        content: article.content,
        tags: article.tags,
        published: article.published,
      }}
    />
  );
}
