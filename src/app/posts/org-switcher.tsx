"use client";

import { useState, useEffect, useRef } from "react";

interface OrgItem {
  id: string;
  name: string;
  role: string;
}

export default function OrgSwitcher({
  currentOrgId,
  compact,
}: {
  currentOrgId?: string | null;
  compact?: boolean;
}) {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded]);

  useEffect(() => {
    fetch("/api/org/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.organizations) setOrgs(data.organizations);
      })
      .catch(() => {});
  }, []);

  if (orgs.length === 0) return null;
  // In compact mode, only render if there are multiple orgs to switch between
  if (compact && orgs.length <= 1) return null;

  const activeOrg = orgs.find((o) => o.id === currentOrgId) || orgs[0];

  async function handleSwitch(orgId: string) {
    if (orgId === activeOrg.id) {
      setExpanded(false);
      return;
    }
    setSwitching(true);
    setSwitchError(false);
    try {
      const res = await fetch("/api/org/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        setSwitchError(true);
        setSwitching(false);
      }
    } catch {
      setSwitchError(true);
      setSwitching(false);
    }
  }

  return (
    <div ref={containerRef} className={compact ? "relative" : "border-t border-base-300 px-4 py-3"}>
      <button
        onClick={() => setExpanded(!expanded)}
        disabled={switching || orgs.length <= 1}
        className={
          compact
            ? "text-sm text-primary font-medium hover:underline disabled:opacity-50"
            : "w-full flex items-center justify-between text-sm text-base-content/70 hover:text-base-content transition-colors disabled:opacity-50"
        }
      >
        {compact ? (
          "Switch"
        ) : (
          <>
            <span className="truncate">{activeOrg.name}</span>
            {orgs.length > 1 && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`w-4 h-4 shrink-0 ml-2 transition-transform ${expanded ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </>
        )}
      </button>
      {switchError && (
        <p className="text-xs text-error mt-1">Failed to switch. Please try again.</p>
      )}
      {expanded && (
        <div
          className={
            compact
              ? "absolute right-0 top-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg p-1 min-w-[180px] z-10"
              : "mt-2 space-y-1"
          }
        >
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              disabled={switching}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors ${
                org.id === activeOrg.id
                  ? "bg-base-200 text-base-content font-medium"
                  : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
              }`}
            >
              <span className="truncate block">{org.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
