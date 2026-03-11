"use client";

import { useState } from "react";
import Link from "next/link";
import ImpLoader from "@/app/components/imp-loader";

interface AccountMedia {
  caption: string | null;
  like_count: number;
  comments_count: number;
  media_url: string | null;
  media_type: string | null;
  permalink: string | null;
  timestamp: string | null;
}

interface AccountResult {
  username: string;
  name: string | null;
  biography: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  follows_count: number | null;
  media_count: number | null;
  media: AccountMedia[];
}

function formatCount(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface LookupViewProps {
  hasFacebook: boolean;
}

export default function LookupView({ hasFacebook }: LookupViewProps) {
  const needsSetup = !hasFacebook;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountResult | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const username = query.trim().replace(/^@/, "");
    if (!username) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/insights/lookup?username=${encodeURIComponent(username)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to look up account");
        return;
      }

      setResult(data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-base-200">
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 px-4 py-3 flex items-center gap-2 shrink-0">
        <Link href="/insights" className="text-base-content/50 hover:text-base-content/70">
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold">Look Up Account</h1>
      </div>

      {needsSetup ? (
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="text-center">
            <p className="text-sm text-base-content/50 mb-4 max-w-xs mx-auto">
              A Facebook connection is needed to look up Instagram accounts.
            </p>
            <a
              href="/api/facebook/auth?returnTo=/insights/lookup"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-info text-info-content rounded-full font-medium hover:opacity-90 transition-opacity text-sm"
            >
              Connect Facebook
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="bg-base-100 border-b border-base-300 px-4 py-3 shrink-0">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Instagram username"
                className="flex-1 input input-bordered input-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="btn btn-neutral btn-sm"
              >
                Search
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-16">
                <ImpLoader message="Looking up account..." />
              </div>
            )}

            {error && (
              <div className="px-4 py-8 text-center">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            {result && (
              <div>
                {/* Profile */}
                <div className="bg-base-100 px-4 py-4">
                  <div className="flex items-center gap-3">
                    {result.profile_picture_url ? (
                      <img
                        src={result.profile_picture_url}
                        alt=""
                        className="w-14 h-14 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-base-300 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate">{result.username}</span>
                      </div>
                      {result.name && (
                        <p className="text-xs text-base-content/60 truncate">{result.name}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 mt-3 text-center">
                    <div>
                      <div className="text-sm font-semibold">{formatCount(result.media_count)}</div>
                      <div className="text-xs text-base-content/50">posts</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        {formatCount(result.followers_count)}
                      </div>
                      <div className="text-xs text-base-content/50">followers</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        {formatCount(result.follows_count)}
                      </div>
                      <div className="text-xs text-base-content/50">following</div>
                    </div>
                  </div>

                  {result.biography && (
                    <p className="text-sm text-base-content/70 mt-3 whitespace-pre-line">
                      {result.biography}
                    </p>
                  )}
                </div>

                {/* Recent Posts */}
                {result.media.length > 0 && (
                  <div className="mt-2">
                    <div className="bg-base-100 px-4 py-2">
                      <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                        Recent Posts
                      </h2>
                    </div>
                    <div className="divide-y divide-base-300">
                      {result.media.map((post, i) => (
                        <a
                          key={i}
                          href={post.permalink || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex gap-3 bg-base-100 px-4 py-3 hover:bg-base-200 transition-colors"
                        >
                          {post.media_url && post.media_type !== "VIDEO" ? (
                            <img
                              src={post.media_url}
                              alt=""
                              className="w-16 h-16 rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded bg-base-300 shrink-0 flex items-center justify-center">
                              {post.media_type === "VIDEO" ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="w-6 h-6 text-base-content/30"
                                >
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  className="w-6 h-6 text-base-content/30"
                                >
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <polyline points="21 15 16 10 5 21" />
                                </svg>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {post.caption && (
                              <p className="text-sm text-base-content line-clamp-2">
                                {post.caption}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-base-content/50">
                              <span>{post.like_count} likes</span>
                              <span>{post.comments_count} comments</span>
                              {post.timestamp && (
                                <span>
                                  {new Date(post.timestamp).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-4 h-4 text-base-content/30 shrink-0 self-center"
                          >
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && !result && (
              <div className="px-4 py-16 text-center">
                <p className="text-sm text-base-content/40">
                  Search for an Instagram account to see their profile and recent posts.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
