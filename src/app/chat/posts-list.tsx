"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import type { Post } from "@/lib/supabase/types";

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function PostsList({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleNewPost(file: File) {
    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch("/api/chat/new-post", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const { postId } = await res.json();
      router.push(`/chat/${postId}`);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="font-semibold text-lg">Post Imp</h1>
        <a
          href="/account"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Account
        </a>
      </div>

      {/* Posts list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {posts.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg mb-1">No posts yet</p>
            <p className="text-sm">
              Tap the button below to create your first post.
            </p>
          </div>
        )}
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => router.push(`/chat/${post.id}`)}
            className="w-full bg-white rounded-xl border p-3 flex items-start gap-3 text-left hover:bg-gray-50 transition-colors"
          >
            <img
              src={post.image_url}
              alt=""
              className="w-16 h-16 rounded-lg object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 line-clamp-2">
                {post.caption || "Generating caption..."}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[post.status] || statusColors.draft}`}
                >
                  {post.status}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(post.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* New post button */}
      <div
        className="bg-white border-t px-4 py-3 shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleNewPost(file);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
        >
          New Post
        </button>
      </div>
    </div>
  );
}
