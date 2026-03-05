"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/db/posts";

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function PostsList({ posts: initialPosts }: { posts: Post[] }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [posts, setPosts] = useState(initialPosts);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleDelete(postId: string) {
    if (!window.confirm("Delete this post?")) return;
    setDeletingId(postId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/delete`, { method: "POST" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
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
    <div className="flex flex-col h-[100dvh] bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-[family-name:var(--font-logo)] ">Post Imp</h1>
        <button onClick={() => setMenuOpen(true)} className="p-1 text-gray-500 hover:text-gray-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Slide-in menu backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      />
      {/* Slide-in menu panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-64 bg-white z-50 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <span className="font-semibold">Menu</span>
          <button onClick={() => setMenuOpen(false)} className="text-gray-400 hover:text-gray-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 py-2">
          <button
            onClick={() => {
              setMenuOpen(false);
              router.push("/posts/new");
            }}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
          >
            New Post
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              router.push("/account");
            }}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
          >
            Account
          </button>
          <a
            href="mailto:support@postimp.com"
            className="block px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
          >
            Support
          </a>
        </nav>
        <div className="border-t px-4 py-3">
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-gray-500 hover:text-gray-700"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Posts list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {deleteError && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm flex items-center justify-between">
            <span>{deleteError}</span>
            <button
              onClick={() => setDeleteError(null)}
              className="text-red-400 hover:text-red-600 ml-2 shrink-0"
            >
              &times;
            </button>
          </div>
        )}
        {posts.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg mb-1">No posts yet</p>
            <p className="text-sm">Tap the button below to create your first post.</p>
          </div>
        )}
        {posts.map((post) => {
          const isDeleting = deletingId === post.id;
          return (
            <button
              key={post.id}
              onClick={() => router.push(`/posts/${post.id}`)}
              className={`w-full bg-white rounded-xl border p-3 flex items-start gap-3 text-left transition-colors ${
                isDeleting ? "opacity-50 pointer-events-none" : "hover:bg-gray-50"
              }`}
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
                    {isDeleting ? "deleting..." : post.status}
                  </span>
                  <span className="text-xs text-gray-400" suppressHydrationWarning>
                    {new Date(post.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex-1" />
                  {isDeleting ? (
                    <span className="shrink-0">
                      <span className="block w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    </span>
                  ) : (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(post.id);
                      }}
                      className="shrink-0 p-0.5 text-gray-300 hover:text-red-500 transition-colors"
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
        className="bg-white border-t px-4 py-3 shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => router.push("/posts/new")}
          className="w-full py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
        >
          New Post
        </button>
      </div>
    </div>
  );
}
