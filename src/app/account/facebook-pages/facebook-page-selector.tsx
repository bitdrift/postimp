"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    async function fetchPages() {
      try {
        const res = await fetch("/api/facebook/pages");
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load pages");
          return;
        }

        setPages(data.pages || []);
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

      router.push("/account?facebook=connected");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading your Facebook pages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="w-full max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Select a Facebook Page</h1>
        <p className="text-gray-600">Choose which Facebook Page to publish posts to.</p>

        {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

        {pages.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <p className="text-gray-600 mb-4">
              No Facebook Pages found. You need a Facebook Page to publish posts.
            </p>
            <a href="/account" className="text-sm text-blue-600 font-medium hover:underline">
              Back to Account
            </a>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setSelectedPage(page)}
                  className={`w-full text-left bg-white rounded-2xl shadow-sm border p-6 transition-colors ${
                    selectedPage?.id === page.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium">{page.name}</p>
                  <p className="text-sm text-gray-500 mt-1">Page ID: {page.id}</p>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedPage || submitting}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Connecting..." : "Connect Page"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
