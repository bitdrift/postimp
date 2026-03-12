"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import OrgSwitcher from "@/app/posts/org-switcher";

export default function AppHeader({ activeOrgId }: { activeOrgId?: string | null }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    document.cookie = "active_org=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <>
      {/* Header bar */}
      <div className="bg-base-100 border-b border-base-300 px-4 py-3 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1.5">
          <Image src="/postimp_logo.png" alt="" width={28} height={32} className="h-7 w-auto" />
          <span className="text-lg font-[family-name:var(--font-logo)] translate-y-1">
            Post Imp
          </span>
        </span>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="p-1 text-base-content/50 hover:text-base-content/70"
        >
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
        className={`fixed inset-0 bg-neutral/40 z-40 transition-opacity duration-300 ${
          menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      />
      {/* Slide-in menu panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-64 bg-base-100 z-50 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-4 py-4 border-b border-base-300 flex items-center justify-between">
          <span className="font-semibold">Menu</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="text-base-content/40 hover:text-base-content/60"
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
            className="w-full text-left px-4 py-3 text-sm hover:bg-base-200 transition-colors"
          >
            New Post
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              router.push("/insights");
            }}
            className="w-full text-left px-4 py-3 text-sm hover:bg-base-200 transition-colors"
          >
            Insights
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              router.push("/account");
            }}
            className="w-full text-left px-4 py-3 text-sm hover:bg-base-200 transition-colors"
          >
            Account
          </button>
          <a
            href="mailto:support@postimp.com"
            className="block px-4 py-3 text-sm hover:bg-base-200 transition-colors"
          >
            Support
          </a>
        </nav>
        <OrgSwitcher currentOrgId={activeOrgId} />
        <div className="border-t border-base-300 px-4 py-3">
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-base-content/50 hover:text-base-content/70"
          >
            Log Out
          </button>
        </div>
      </div>
    </>
  );
}
