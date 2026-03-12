"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Post } from "@/lib/db/posts";
import AppHeader from "@/app/components/app-header";

type Filter = "mine" | "all";

const statusColors: Record<string, string> = {
  draft: "bg-warning/10 text-warning",
  published: "bg-success/10 text-success",
  cancelled: "bg-base-200 text-base-content/50",
};

export default function PostsList({
  myPosts,
  allPosts,
  activeOrgId,
  activeOrgName,
}: {
  myPosts: Post[];
  allPosts: Post[];
  activeOrgId: string;
  activeOrgName: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("mine");
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasOtherPosts = allPosts.length > myPosts.length;
  const posts = (filter === "mine" ? myPosts : allPosts).filter((p) => !deletedIds.has(p.id));

  async function handleDelete(postId: string) {
    if (!window.confirm("Delete this post?")) return;
    setDeletingId(postId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/delete`, { method: "POST" });
      if (res.ok) {
        setDeletedIds((prev) => new Set(prev).add(postId));
      } else {
        setDeleteError("Could not delete post. Please try again.");
      }
    } catch {
      setDeleteError("Could not delete post. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-base-200">
      <AppHeader activeOrgId={activeOrgId} />

      {/* Filter bar */}
      <div className="bg-base-100 border-b border-base-300 px-4 py-2 flex items-center gap-1 shrink-0">
        <span className="text-xs text-base-content/40 mr-2 truncate">{activeOrgName}</span>
        <span className="text-xs font-medium text-base-content/70">My Posts</span>
        {hasOtherPosts && (
          <button
            onClick={() => setFilter(filter === "mine" ? "all" : "mine")}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              filter === "all"
                ? "bg-neutral text-neutral-content"
                : "text-base-content/50 hover:bg-base-200"
            }`}
          >
            All Posts
          </button>
        )}
      </div>

      {/* Posts list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {deleteError && (
          <div className="bg-error/10 text-error rounded-lg p-3 text-sm flex items-center justify-between">
            <span>{deleteError}</span>
            <button
              onClick={() => setDeleteError(null)}
              className="text-error/60 hover:text-error ml-2 shrink-0"
            >
              &times;
            </button>
          </div>
        )}
        {posts.length === 0 && (
          <div className="text-center text-base-content/40 mt-20">
            <p className="text-lg mb-1">No posts yet</p>
            <p className="text-sm">
              {filter === "mine"
                ? "You haven't created any posts for this org yet."
                : "No posts in this organization yet."}
            </p>
          </div>
        )}
        {posts.map((post) => {
          const isDeleting = deletingId === post.id;
          return (
            <button
              key={post.id}
              onClick={() => router.push(`/posts/${post.id}`)}
              className={`w-full bg-base-100 rounded-xl border border-base-300 p-3 flex items-start gap-3 text-left transition-colors ${
                isDeleting ? "opacity-50 pointer-events-none" : "hover:bg-base-200"
              }`}
            >
              <img
                src={post.image_url}
                alt=""
                className="w-16 h-16 rounded-lg object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-base-content line-clamp-2">
                  {post.caption || "Generating caption..."}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[post.status] || statusColors.draft}`}
                  >
                    {isDeleting ? "deleting..." : post.status}
                  </span>
                  <span className="text-xs text-base-content/40" suppressHydrationWarning>
                    {new Date(post.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex-1" />
                  {isDeleting ? (
                    <span className="shrink-0">
                      <span className="block w-4 h-4 border-2 border-base-content/30 border-t-base-content/60 rounded-full animate-spin" />
                    </span>
                  ) : (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(post.id);
                      }}
                      className="shrink-0 p-0.5 text-base-content/30 hover:text-error transition-colors"
                      title="Delete post"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* New post button */}
      <div
        className="bg-base-100 border-t border-base-300 px-4 py-3 shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => router.push("/posts/new")}
          className="w-full py-3 bg-neutral text-neutral-content rounded-full font-medium hover:bg-neutral/80 transition-colors"
        >
          New Post
        </button>
      </div>
    </div>
  );
}
