"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/supabase/types";

interface ChatViewProps {
  initialMessages: Message[];
  profileId: string;
}

export default function ChatView({ initialMessages, profileId }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Subscribe to realtime outbound messages
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("web-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.channel === "web" && newMsg.direction === "outbound") {
            setMessages((prev) => {
              // Deduplicate by id
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
  }, [profileId]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    blobUrlsRef.current.add(url);
    setImagePreview(url);
  }

  // Track blob URLs so we can revoke them on unmount
  const blobUrlsRef = useRef<Set<string>>(new Set());

  function clearImage(revoke = true) {
    setImageFile(null);
    if (imagePreview && revoke) {
      URL.revokeObjectURL(imagePreview);
      blobUrlsRef.current.delete(imagePreview);
    }
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Revoke all blob URLs on unmount
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body && !imageFile) return;

    setSending(true);

    // Optimistic UI: add user message immediately
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      profile_id: profileId,
      phone: null,
      direction: "inbound",
      body: body || (imageFile ? "(photo)" : ""),
      media_url: imagePreview,
      twilio_sid: null,
      channel: "web",
      post_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");

    try {
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        formData.append("body", body);
        clearImage(false); // Keep blob URL alive for optimistic message
        await fetch("/api/chat/upload", { method: "POST", body: formData });
      } else {
        await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
      }
    } catch {
      // Error state could be added here
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
      post_id: null,
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
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-[family-name:var(--font-logo)] text-pink">Post Imp</h1>
        <a href="/account" className="text-sm text-gray-500 hover:text-gray-700">
          Account
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg mb-1">Welcome to Post Imp</p>
            <p className="text-sm">Send a photo with a description to create a post.</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
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

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 pb-2 shrink-0">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Selected"
              className="h-20 w-20 object-cover rounded-lg border"
            />
            <button
              onClick={() => clearImage()}
              className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="bg-white border-t px-4 py-3 flex items-center gap-2 shrink-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={imageFile ? "Add a description..." : "Type a message..."}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-pink/20"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || (!input.trim() && !imageFile)}
          className="shrink-0 w-10 h-10 rounded-full bg-pink text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
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
    </div>
  );
}

/** Parse structured caption messages (CAPTION_START...CAPTION_END + PREVIEW:url) */
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
      className="inline-flex items-center ml-1 text-gray-400 hover:text-gray-600 align-middle"
      title="Copy link"
    >
      {copied ? (
        <span className="text-xs text-green-600">Copied!</span>
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

/** Render text with clickable URLs */
function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <span className={className}>
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

function MessageBubble({
  message,
  onSend,
  onFillInput,
}: {
  message: Message;
  onSend?: (text: string) => void;
  onFillInput?: (text: string) => void;
}) {
  const isUser = message.direction === "inbound";
  const draft = !isUser && message.body ? parseDraftMessage(message.body) : null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-pink text-white rounded-br-md"
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
              <p className="text-sm whitespace-pre-wrap break-words">{draft.caption}</p>
            </div>
            {draft.previewUrl && (
              <span className="inline-flex items-center gap-1">
                <a
                  href={draft.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Preview &rarr;
                </a>
                <CopyButton url={draft.previewUrl} />
              </span>
            )}
            <p className="text-xs text-gray-500">
              What do you think? Suggest changes, or approve to publish.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onSend?.("Approve")}
                className="px-4 py-1.5 bg-pink text-white text-sm rounded-full hover:bg-pink-hover transition-colors"
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
