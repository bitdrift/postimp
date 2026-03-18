"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";

interface ArticleData {
  title: string;
  slug: string;
  description: string;
  content: string;
  tags: string[];
  published: boolean;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function WriteArticlePage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const published = article?.published ?? false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/articles/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          articleId: articleId || undefined,
          responseId: responseId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.error || "Something went wrong." },
        ]);
        return;
      }

      if (data.articleId) setArticleId(data.articleId);
      if (data.responseId) setResponseId(data.responseId);
      if (data.article) setArticle(data.article);

      if (data.textResponse) {
        setMessages((prev) => [...prev, { role: "assistant", text: data.textResponse }]);
      } else {
        const status = data.published
          ? "Article published!"
          : data.article
            ? "Article updated. Let me know if you'd like any changes."
            : "Done.";
        setMessages((prev) => [...prev, { role: "assistant", text: status }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Network error. Please retry." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handlePublish() {
    sendMessage("Publish it");
  }

  const baseUrl = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Write an Article</h1>
      <p className="mt-2 text-base-content/50">
        Describe an article idea and the AI will draft it. Give feedback to revise, then publish
        when ready.
      </p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chat panel */}
        <div className="flex flex-col">
          <div className="flex-1 min-h-[400px] max-h-[600px] overflow-y-auto rounded-xl border border-base-300 bg-base-200/30 p-4 space-y-4">
            {messages.length === 0 && !loading && (
              <p className="text-base-content/30 text-sm">
                Enter an article idea to get started...
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-content"
                      : "bg-base-300 text-base-content"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-base-300 text-base-content/50 rounded-xl px-4 py-2.5 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce [animation-delay:0.2s]">.</span>
                    <span className="animate-bounce [animation-delay:0.4s]">.</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                articleId ? "Give feedback or say 'publish it'..." : "Describe your article idea..."
              }
              disabled={loading || published}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-base-300 bg-base-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || published}
              className="self-end rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-content hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </form>
        </div>

        {/* Article preview panel */}
        <div className="flex flex-col">
          {article ? (
            <div className="rounded-xl border border-base-300 bg-base-100 overflow-hidden">
              <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
                <h2 className="font-semibold text-sm">Article Preview</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-base-200 hover:bg-base-300 transition-colors"
                  >
                    {showPreview ? "Show Info" : "Show Content"}
                  </button>
                  {!published && articleId && (
                    <button
                      onClick={handlePublish}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>

              {published && (
                <div className="px-4 py-3 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-900">
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    Published at{" "}
                    <a
                      href={`${baseUrl}/learn/${article.slug}`}
                      className="underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      /learn/{article.slug}
                    </a>
                  </p>
                </div>
              )}

              <div className="p-4 max-h-[520px] overflow-y-auto">
                {showPreview ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <h1>{article.title}</h1>
                    <ReactMarkdown>{article.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-base-content/60">Title:</span>{" "}
                      <span>{article.title}</span>
                    </div>
                    <div>
                      <span className="font-medium text-base-content/60">Slug:</span>{" "}
                      <code className="text-xs bg-base-200 px-1.5 py-0.5 rounded">
                        {article.slug}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium text-base-content/60">Description:</span>{" "}
                      <span className="text-base-content/80">{article.description}</span>
                    </div>
                    {article.tags.length > 0 && (
                      <div>
                        <span className="font-medium text-base-content/60">Tags:</span>{" "}
                        <span className="inline-flex gap-1.5 flex-wrap">
                          {article.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-base-200 px-2 py-0.5 rounded-full text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-base-content/60">Status:</span>{" "}
                      <span
                        className={`text-xs font-medium ${published ? "text-green-600" : "text-yellow-600"}`}
                      >
                        {published ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[400px] flex items-center justify-center rounded-xl border border-base-300 border-dashed bg-base-200/20">
              <p className="text-base-content/30 text-sm">
                Article preview will appear here after the first draft.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
