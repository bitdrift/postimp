"use client";

import { useState } from "react";
import Link from "next/link";
import ImpLoader from "@/app/components/imp-loader";

export default function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="max-w-5xl mx-auto px-6 py-6 w-full flex items-center justify-between shrink-0">
      <span className="flex items-center gap-2">
        <div className="-mx-8">
          <ImpLoader size={115} />
        </div>
        <Link
          href="/"
          className="text-3xl sm:text-4xl font-[family-name:var(--font-logo)] leading-none translate-y-1.5"
        >
          Post Imp
        </Link>
      </span>
      <div className="flex items-center gap-4">
        {/* Desktop: show all links inline */}
        <Link
          href="/learn"
          className="hidden sm:inline text-sm text-base-content/60 hover:text-base-content transition-colors"
        >
          Learn
        </Link>
        <Link
          href="/login"
          className="hidden sm:inline text-sm text-base-content/60 hover:text-base-content transition-colors"
        >
          Log in
        </Link>

        {/* Mobile: "Log in" with dropdown arrow, reveals Learn */}
        <div className="relative sm:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1 text-sm text-base-content/60 hover:text-base-content transition-colors"
          >
            More
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${menuOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 bg-base-100 border border-base-content/10 rounded-lg shadow-lg py-2 min-w-[120px] z-50">
              <Link
                href="/login"
                className="block px-4 py-2 text-sm text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Log in
              </Link>
              <Link
                href="/learn"
                className="block px-4 py-2 text-sm text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Learn
              </Link>
            </div>
          )}
        </div>

        <Link
          href="/signup"
          className="text-sm bg-neutral text-neutral-content px-4 py-2 rounded-lg hover:bg-neutral/80 transition-colors"
        >
          Sign up
        </Link>
      </div>
    </nav>
  );
}
