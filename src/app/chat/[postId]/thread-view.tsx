"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message, Post } from "@/lib/supabase/types";

interface ThreadViewProps {
  post: Post;
  initialMessages: Message[];
  profileId: string;
}

export default function ThreadView({
  post,
  initialMessages,
  profileId,
}: ThreadViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "preview">("chat");
  const [currentPost, setCurrentPost] = useState(post);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        }
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

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

    try {
      await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
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
        body: JSON.stringify({ body: text }),
      });
    } catch {
      // Error handling could be added
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <a
            href="/chat"
            className="shrink-0 text-gray-500 hover:text-gray-700"
          >
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
          </a>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {currentPost.caption
                ? currentPost.caption.slice(0, 50) +
                  (currentPost.caption.length > 50 ? "..." : "")
                : "New Post"}
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                currentPost.status === "published"
                  ? "bg-green-100 text-green-800"
                  : currentPost.status === "cancelled"
                    ? "bg-gray-100 text-gray-500"
                    : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {currentPost.status}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === "chat"
                ? "border-black text-black"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === "preview"
                ? "border-black text-black"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {activeTab === "chat" ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-20">
                <p className="text-sm">Generating your caption...</p>
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
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar (no photo picker) */}
          <form
            onSubmit={handleSend}
            className="bg-white border-t px-4 py-3 flex items-center gap-2 shrink-0"
            style={{
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-black/10"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <img
              src={currentPost.image_url}
              alt=""
              className="w-full aspect-square object-cover"
            />
            <div className="p-4">
              <p className="text-sm whitespace-pre-wrap break-words">
                {currentPost.caption || "Caption pending..."}
              </p>
            </div>
          </div>
        </div>
      )}
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

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function ThreadMessageBubble({
  message,
  onSend,
  onFillInput,
}: {
  message: Message;
  onSend?: (text: string) => void;
  onFillInput?: (text: string) => void;
}) {
  const isUser = message.direction === "inbound";
  const draft =
    !isUser && message.body ? parseDraftMessage(message.body) : null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-black text-white rounded-br-md"
            : "bg-white text-gray-900 border rounded-bl-md"
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
            <div className="bg-gray-50 border rounded-lg p-3">
              <p className="text-sm whitespace-pre-wrap break-words">
                {draft.caption}
              </p>
            </div>
            {draft.previewUrl && (
              <a
                href={draft.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Preview &rarr;
              </a>
            )}
            <p className="text-xs text-gray-500">
              What do you think? Suggest changes, or approve to publish.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onSend?.("Approve")}
                className="px-4 py-1.5 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onFillInput?.(draft.caption)}
                className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ) : message.body ? (
          <p className="text-sm whitespace-pre-wrap break-words">
            <LinkifiedText text={message.body} />
          </p>
        ) : null}
        <p className="text-[10px] mt-1 text-gray-400">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
