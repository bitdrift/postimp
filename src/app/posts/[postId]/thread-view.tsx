"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import ImpLoader from "@/app/components/imp-loader";
import type { Post } from "@/lib/db/posts";
import type { Message } from "@/lib/db/messages";

interface ThreadViewProps {
  post: Post;
  initialMessages: Message[];
  profileId: string;
  instagramUsername: string | null;
  instagramProfilePic: string | null;
  instagramFollowers: number | null;
}

export default function ThreadView({
  post,
  initialMessages,
  profileId,
  instagramUsername,
  instagramProfilePic,
  instagramFollowers,
}: ThreadViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "preview" | "stats">("chat");
  const [currentPost, setCurrentPost] = useState(post);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollPos = useRef<number>(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Extract the latest draft caption from messages for the preview tab
  const latestCaption = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.direction === "outbound" && msg.body) {
        const draft = parseDraftMessage(msg.body);
        if (draft) return draft.caption;
      }
    }
    return null;
  }, [messages]);

  const previewCaption = latestCaption || currentPost.caption;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Subscribe to realtime messages for this post
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`thread-${post.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `post_id=eq.${post.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.channel === "web" && newMsg.direction === "outbound") {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  // Subscribe to post updates (caption changes, status changes)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`post-${post.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "posts",
          filter: `id=eq.${post.id}`,
        },
        (payload) => {
          setCurrentPost(payload.new as Post);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  function switchTab(tab: "chat" | "preview" | "stats") {
    if (tab === activeTab) return;
    // Save scroll position when leaving chat
    if (activeTab === "chat" && chatScrollRef.current) {
      savedScrollPos.current = chatScrollRef.current.scrollTop;
    }
    setActiveTab(tab);
  }

  // Restore scroll position when switching back to chat
  useEffect(() => {
    if (activeTab === "chat" && chatScrollRef.current && savedScrollPos.current > 0) {
      chatScrollRef.current.scrollTop = savedScrollPos.current;
    }
  }, [activeTab]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;

    setSending(true);
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      profile_id: profileId,
      phone: null,
      direction: "inbound",
      body,
      media_url: null,
      twilio_sid: null,
      channel: "web",
      post_id: post.id,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, postId: post.id }),
      });
    } catch {
      // Error handling could be added
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleQuickSend(text: string) {
    if (sending) return;
    setSending(true);
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      profile_id: profileId,
      phone: null,
      direction: "inbound",
      body: text,
      media_url: null,
      twilio_sid: null,
      channel: "web",
      post_id: post.id,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    try {
      await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, postId: post.id }),
      });
    } catch {
      // Error handling could be added
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-base-200">
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/posts" className="shrink-0 text-base-content/50 hover:text-base-content/70">
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
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {currentPost.caption
                ? currentPost.caption.slice(0, 50) + (currentPost.caption.length > 50 ? "..." : "")
                : "New Post"}
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                currentPost.status === "published"
                  ? "bg-success/10 text-success"
                  : currentPost.status === "cancelled"
                    ? "bg-base-200 text-base-content/50"
                    : "bg-warning/10 text-warning"
              }`}
            >
              {currentPost.status}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-base-300">
          <button
            onClick={() => switchTab("chat")}
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === "chat"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/40 hover:text-base-content/60"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => switchTab("preview")}
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === "preview"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/40 hover:text-base-content/60"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => switchTab("stats")}
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === "stats"
                ? "border-primary text-primary"
                : "border-transparent text-base-content/40 hover:text-base-content/60"
            }`}
          >
            Stats
          </button>
        </div>
      </div>

      {activeTab === "stats" ? (
        <StatsTab postId={post.id} isPublished={currentPost.status === "published"} />
      ) : activeTab === "chat" ? (
        <>
          {/* Messages */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex items-center justify-center mt-16">
                <ImpLoader message="Generating your caption..." />
              </div>
            )}
            {messages.map((msg) => (
              <ThreadMessageBubble
                key={msg.id}
                message={msg}
                onSend={handleQuickSend}
                onFillInput={(text) => {
                  setInput(text);
                  inputRef.current?.focus();
                }}
                onViewPreview={() => switchTab("preview")}
              />
            ))}
            {sending && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar (no photo picker) */}
          <form
            onSubmit={handleSend}
            className="bg-base-100 border-t border-base-300 px-4 py-3 flex items-end gap-2 shrink-0"
            style={{
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-base-200 rounded-2xl px-4 py-2.5 text-base-content placeholder-base-content/40 outline-none focus:ring-2 focus:ring-primary/20 resize-none overflow-hidden"
              style={{ maxHeight: 120 }}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-full bg-neutral text-neutral-content flex items-center justify-center disabled:opacity-30 transition-opacity"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </>
      ) : (
        /* Preview tab */
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-base-200">
          {currentPost.status === "published" && currentPost.instagram_permalink ? (
            <div className="flex justify-center">
              <InstagramEmbed permalink={currentPost.instagram_permalink} />
            </div>
          ) : (
            <>
              <div className="bg-white rounded border border-gray-300 overflow-hidden max-w-[400px] mx-auto text-black">
                {/* Header */}
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  {instagramProfilePic ? (
                    <img
                      src={instagramProfilePic}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                      {(instagramUsername || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold block leading-tight">
                      {instagramUsername || "your_account"}
                    </span>
                    {instagramFollowers !== null && (
                      <span className="text-xs text-gray-500">
                        {instagramFollowers.toLocaleString()} follower
                        {instagramFollowers !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-white bg-[#0095f6]/40 px-4 py-1.5 rounded">
                    View profile
                  </span>
                </div>
                {/* Image */}
                <img
                  src={currentPost.image_url}
                  alt=""
                  className="w-full aspect-square object-cover"
                />
                {/* "View more on Instagram" */}
                <div className="px-3 pt-3 pb-2">
                  <span className="text-sm text-[#00376b]/40">View more on Instagram</span>
                </div>
                <div className="mx-3 border-t border-gray-200" />
                {/* Action icons row */}
                <div className="flex items-center px-3 py-2.5">
                  <div className="flex items-center gap-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6 text-black/25"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6 text-black/25"
                    >
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6 text-black/25"
                    >
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="flex-1" />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-6 h-6 text-black/25"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                </div>
                {/* Likes */}
                <div className="px-3">
                  <p className="text-sm font-semibold text-black/25">0 likes</p>
                </div>
                {/* Username + Caption */}
                <div className="px-3 pt-1 pb-2">
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {previewCaption ? (
                      <>
                        <span className="font-semibold">{instagramUsername || "your_account"}</span>{" "}
                        <CaptionWithHashtags text={previewCaption} />
                      </>
                    ) : (
                      <span className="text-black/25">Caption pending...</span>
                    )}
                  </p>
                </div>
                {/* Add a comment + IG logo */}
                <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-200">
                  <span className="text-sm text-black/25">Add a comment...</span>
                  <svg className="w-6 h-6 text-black/25" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.982c2.937 0 3.285.011 4.445.064a6.087 6.087 0 012.042.379 3.408 3.408 0 011.265.823 3.408 3.408 0 01.823 1.265 6.087 6.087 0 01.379 2.042c.053 1.16.064 1.508.064 4.445s-.011 3.285-.064 4.445a6.087 6.087 0 01-.379 2.042 3.643 3.643 0 01-2.088 2.088 6.087 6.087 0 01-2.042.379c-1.16.053-1.508.064-4.445.064s-3.285-.011-4.445-.064a6.087 6.087 0 01-2.042-.379 3.408 3.408 0 01-1.265-.823 3.408 3.408 0 01-.823-1.265 6.087 6.087 0 01-.379-2.042c-.053-1.16-.064-1.508-.064-4.445s.011-3.285.064-4.445a6.087 6.087 0 01.379-2.042 3.408 3.408 0 01.823-1.265 3.408 3.408 0 011.265-.823 6.087 6.087 0 012.042-.379c1.16-.053 1.508-.064 4.445-.064M12 1c-2.987 0-3.362.013-4.535.066a8.074 8.074 0 00-2.67.511 5.392 5.392 0 00-1.949 1.27 5.392 5.392 0 00-1.269 1.948 8.074 8.074 0 00-.51 2.67C1.012 8.638 1 9.013 1 12s.013 3.362.066 4.535a8.074 8.074 0 00.511 2.67 5.392 5.392 0 001.27 1.949 5.392 5.392 0 001.948 1.269 8.074 8.074 0 002.67.51C8.638 22.988 9.013 23 12 23s3.362-.013 4.535-.066a8.074 8.074 0 002.67-.511 5.625 5.625 0 003.218-3.218 8.074 8.074 0 00.51-2.67C22.988 15.362 23 14.987 23 12s-.013-3.362-.066-4.535a8.074 8.074 0 00-.511-2.67 5.392 5.392 0 00-1.27-1.949 5.392 5.392 0 00-1.948-1.269 8.074 8.074 0 00-2.67-.51C15.362 1.012 14.987 1 12 1zm0 5.351A5.649 5.649 0 1017.649 12 5.649 5.649 0 0012 6.351zm0 9.316A3.667 3.667 0 1115.667 12 3.667 3.667 0 0112 15.667zm5.872-10.859a1.32 1.32 0 100 2.64 1.32 1.32 0 000-2.64z" />
                  </svg>
                </div>
              </div>
              {currentPost.status === "draft" && (
                <button
                  onClick={() => {
                    handleQuickSend("Approve");
                    switchTab("chat");
                  }}
                  disabled={sending}
                  className="w-full max-w-[400px] mx-auto block mt-4 py-3 bg-neutral text-neutral-content rounded-full font-medium hover:bg-neutral/80 disabled:opacity-50 transition-colors"
                >
                  Approve
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface StatsData {
  likes?: number;
  comments?: number;
  impressions?: number;
  reach?: number;
  saved?: number;
  shares?: number;
  profile_visits?: number;
  follows?: number;
  posted_at?: string;
  [key: string]: unknown;
}

function StatCard({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="bg-base-100 rounded-xl border border-base-300 p-4 text-center">
      <p className="text-2xl font-bold">{value ?? "—"}</p>
      <p className="text-xs text-base-content/50 mt-1">{label}</p>
    </div>
  );
}

function StatsTab({ postId, isPublished }: { postId: string; isPublished: boolean }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/stats`);
      const data = await res.json();
      if (data.stats) {
        setStats(data.stats);
        setFetchedAt(data.fetched_at);
      } else if (data.reason === "not_published") {
        setStats(null);
      } else if (data.error) {
        setError("Could not load stats.");
      }
    } catch {
      setError("Could not load stats.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (isPublished) fetchStats();
  }, [isPublished, fetchStats]);

  if (!isPublished) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center text-base-content/40">
          <p className="text-lg mb-1">No stats yet</p>
          <p className="text-sm">Stats will appear here once the post is published to Instagram.</p>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <ImpLoader message="Loading stats..." />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-base-content/50 mb-3">{error}</p>
          <button onClick={fetchStats} className="text-sm text-primary font-medium hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasInsights = stats?.reach !== undefined;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {/* Engagement */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard value={stats?.likes} label="Likes" />
        <StatCard value={stats?.comments} label="Comments" />
        {hasInsights && (
          <>
            <StatCard value={stats?.saved} label="Saves" />
            <StatCard value={stats?.shares} label="Shares" />
          </>
        )}
      </div>

      {/* Reach & Discovery */}
      {hasInsights && (
        <>
          <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide pt-1">
            Reach &amp; Discovery
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard value={stats?.reach} label="Reach" />
            <StatCard value={stats?.impressions} label="Impressions" />
            <StatCard value={stats?.profile_visits} label="Profile Visits" />
            <StatCard value={stats?.follows} label="Follows" />
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-base-content/40">
          {fetchedAt
            ? `Updated ${new Date(fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : ""}
        </p>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}

function CaptionWithHashtags({ text }: { text: string }) {
  const parts = text.split(/(#\w+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <span key={i} className="text-[#00376b]/70">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function InstagramEmbed({ permalink }: { permalink: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Instagram embed.js if not already present
    const existing = document.querySelector('script[src*="instagram.com/embed.js"]');
    if (existing) {
      // Script already loaded — just re-process embeds
      (
        window as unknown as { instgrm?: { Embeds: { process: () => void } } }
      ).instgrm?.Embeds.process();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, [permalink]);

  return (
    <div ref={containerRef} className="w-full max-w-[400px]">
      <blockquote
        className="instagram-media"
        data-instgrm-captioned
        data-instgrm-permalink={permalink}
        style={{ width: "100%", margin: 0 }}
      />
    </div>
  );
}

/** Parse structured caption messages */
function parseDraftMessage(body: string) {
  const captionMatch = body.match(/CAPTION_START\n([\s\S]*?)\nCAPTION_END/);
  const previewMatch = body.match(/PREVIEW:(https?:\/\/\S+)/);
  if (!captionMatch) return null;
  const headerMatch = body.match(/^(.+?)\n\nCAPTION_START/);
  return {
    header: headerMatch?.[1] || "Draft caption:",
    caption: captionMatch[1],
    previewUrl: previewMatch?.[1] || null,
  };
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center ml-1 text-base-content/40 hover:text-base-content/60 align-middle"
      title="Copy link"
    >
      {copied ? (
        <span className="text-xs text-success">Copied!</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <span key={i} className="inline">
            <a
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline break-all"
            >
              {part}
            </a>
            <CopyButton url={part} />
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-base-100 text-base-content border border-base-300 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="block w-2 h-2 rounded-full bg-base-content/40"
              style={{
                animation: "typing-dot 1.4s infinite ease-in-out both",
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes typing-dot {
            0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}

function ThreadMessageBubble({
  message,
  onSend,
  onFillInput,
  onViewPreview,
}: {
  message: Message;
  onSend?: (text: string) => void;
  onFillInput?: (text: string) => void;
  onViewPreview?: () => void;
}) {
  const isUser = message.direction === "inbound";
  const draft = !isUser && message.body ? parseDraftMessage(message.body) : null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-neutral text-neutral-content rounded-br-md"
            : "bg-base-100 text-base-content border border-base-300 rounded-bl-md"
        }`}
      >
        {message.media_url && (
          <img
            src={message.media_url}
            alt=""
            className="max-w-full rounded-lg mb-2"
            style={{ maxHeight: 200 }}
          />
        )}
        {draft ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{draft.header}</p>
            <div className="bg-base-200 border border-base-300 rounded-lg p-3">
              <p className="text-sm whitespace-pre-wrap break-words">{draft.caption}</p>
            </div>
            {draft.previewUrl && (
              <span className="inline-flex items-center gap-1">
                <button
                  onClick={() => onViewPreview?.()}
                  className="inline-flex items-center gap-1 text-sm text-info hover:text-info font-medium"
                >
                  View Preview &rarr;
                </button>
                <CopyButton url={draft.previewUrl} />
              </span>
            )}
            <p className="text-xs text-base-content/50">
              What do you think? Suggest changes, or approve to publish.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onSend?.("Approve")}
                className="px-4 py-1.5 bg-neutral text-neutral-content text-sm rounded-full hover:bg-neutral/80 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onFillInput?.(draft.caption)}
                className="px-4 py-1.5 bg-base-200 text-base-content/70 text-sm rounded-full hover:bg-base-300 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ) : message.body && !(message.media_url && message.body === "(photo)") ? (
          isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words">
              <LinkifiedText text={message.body} />
            </p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-base-content prose-strong:text-base-content">
              <ReactMarkdown>{message.body}</ReactMarkdown>
            </div>
          )
        ) : null}
        <p className="text-[10px] mt-1 text-base-content/40" suppressHydrationWarning>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
