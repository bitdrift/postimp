import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Post } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ token: string }>;
}

async function getPost(token: string): Promise<Post | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("posts")
    .select("*")
    .eq("preview_token", token)
    .single();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const post = await getPost(token);

  if (!post) return { title: "Post Not Found" };

  const caption = post.caption || "Check out this post!";
  const description =
    caption.length > 160 ? caption.substring(0, 157) + "..." : caption;

  return {
    title: "Post Imp Preview",
    description,
    openGraph: {
      title: "Post Imp Preview",
      description,
      images: [post.image_url],
    },
  };
}

export default async function PreviewPage({ params }: Props) {
  const { token } = await params;
  const post = await getPost(token);

  if (!post) notFound();

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800",
    published: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {/* Status badge */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                <span className="text-white text-xs font-bold">PI</span>
              </div>
              <span className="text-sm font-[family-name:var(--font-logo)]">Post Imp</span>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[post.status] || statusColors.draft}`}
            >
              {post.status}
            </span>
          </div>

          {/* Image */}
          <div className="aspect-square relative bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image_url}
              alt="Post preview"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Caption */}
          <div className="p-4">
            <p className="text-sm whitespace-pre-line leading-relaxed">
              {post.caption}
            </p>
            <p className="text-xs text-gray-400 mt-3">
              {new Date(post.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by Post Imp
        </p>
      </div>
    </div>
  );
}
