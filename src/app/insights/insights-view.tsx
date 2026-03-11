"use client";

import Link from "next/link";

export default function InsightsView() {
  return (
    <div className="flex flex-col h-[100dvh] bg-base-200">
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/posts" className="text-base-content/50 hover:text-base-content/70">
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
          <h1 className="text-lg font-semibold">Insights</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-base-300/50 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8 text-base-content/40"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-1">Inspiration Accounts</h2>
          <p className="text-sm text-base-content/50 mb-6 max-w-xs mx-auto">
            Add Instagram accounts you admire to learn from their content and style.
          </p>
          <Link
            href="/insights/lookup"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral text-neutral-content rounded-full font-medium hover:bg-neutral/80 transition-colors text-sm"
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Inspiration Account
          </Link>
        </div>
      </div>
    </div>
  );
}
