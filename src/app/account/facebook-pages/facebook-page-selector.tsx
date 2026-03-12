"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

export default function FacebookPageSelector() {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";

  useEffect(() => {
    async function fetchPages() {
      try {
        const res = await fetch("/api/facebook/pages");
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load pages");
          return;
        }

        const fetchedPages = data.pages || [];
        setPages(fetchedPages);
        if (fetchedPages.length === 1) {
          setSelectedPage(fetchedPages[0]);
        }
      } catch {
        setError("Failed to load Facebook pages. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchPages();
  }, []);

  async function handleSubmit() {
    if (!selectedPage) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/facebook/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: selectedPage.id,
          page_name: selectedPage.name,
          page_access_token: selectedPage.access_token,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save page selection");
        return;
      }

      router.push(returnTo.startsWith("/") ? returnTo : "/account");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <p className="text-base-content/50">Loading your Facebook pages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 px-4 py-6">
      <div className="w-full max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Select a Facebook Page</h1>
        <p className="text-base-content/60">Choose which Facebook Page to publish posts to.</p>

        {error && <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>}

        {pages.length === 0 ? (
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8 text-center">
            <p className="text-base-content/60 mb-4">
              No Facebook Pages found. If you have a Page linked to your Instagram account, make
              sure you granted page permissions during login.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => router.push(returnTo.startsWith("/") ? returnTo : "/account")}
                className="w-full bg-info text-neutral-content rounded-lg py-2.5 font-medium hover:bg-info/80 transition-colors"
              >
                Continue without a Page
              </button>
              <a href="/account" className="text-sm text-base-content/50 hover:underline">
                Back to Account
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pages.map((page) => {
                const selected = selectedPage?.id === page.id;
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setSelectedPage(page)}
                    className={`w-full text-left bg-base-100 rounded-2xl shadow-sm border p-6 transition-colors flex items-center gap-4 ${
                      selected
                        ? "border-info bg-info/10"
                        : "border-base-300 hover:border-base-content/30"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        selected ? "border-info" : "border-base-content/30"
                      }`}
                    >
                      {selected && <div className="w-2.5 h-2.5 rounded-full bg-info" />}
                    </div>
                    <div>
                      <p className="font-medium">{page.name}</p>
                      <p className="text-sm text-base-content/50 mt-1">Page ID: {page.id}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedPage || submitting}
              className="w-full bg-info text-neutral-content rounded-lg py-2.5 font-medium hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Connecting..." : "Connect Page"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
