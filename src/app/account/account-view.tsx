"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/db/profiles";
import type { InstagramConnection } from "@/lib/db/instagram";
import type { FacebookConnection } from "@/lib/db/facebook";
import {
  REQUIRED_INSTAGRAM_SCOPES,
  REQUIRED_FACEBOOK_SCOPES,
  needsReauth,
} from "@/lib/core/scopes";
import OrgSwitcher from "@/app/posts/org-switcher";
import AppHeader from "@/app/components/app-header";

export default function AccountView({
  activeOrgId,
  activeOrgName,
}: {
  activeOrgId: string | null;
  activeOrgName: string | null;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <p className="text-base-content/50">Loading...</p>
        </div>
      }
    >
      <AccountContent activeOrgId={activeOrgId} activeOrgName={activeOrgName} />
    </Suspense>
  );
}

function AccountContent({
  activeOrgId,
  activeOrgName,
}: {
  activeOrgId: string | null;
  activeOrgName: string | null;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [instagram, setInstagram] = useState<InstagramConnection | null>(null);
  const [facebook, setFacebook] = useState<FacebookConnection | null>(null);
  const [hasPendingFb, setHasPendingFb] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [tone, setTone] = useState("");
  const [captionStyle, setCaptionStyle] = useState<"polished" | "casual" | "minimal">("polished");
  const [targetAudience, setTargetAudience] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [editing, setEditing] = useState(false);
  const [igError, setIgError] = useState("");
  const [fbError, setFbError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      const detail = searchParams.get("detail");
      if (urlError === "instagram_denied") {
        setIgError("Instagram connection was cancelled.");
      } else if (urlError === "instagram_failed") {
        setIgError(detail || "Failed to connect Instagram. Please try again.");
      } else if (urlError === "facebook_denied") {
        setFbError("Facebook connection was cancelled.");
      } else if (urlError === "facebook_failed") {
        setFbError(detail || "Failed to connect Facebook. Please try again.");
      } else if (urlError === "invalid_state") {
        setIgError("Invalid session. Please try connecting again.");
      }
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (!p?.onboarding_completed) {
        router.push("/onboarding");
        return;
      }

      setProfile(p);
      setBrandName(p.brand_name || "");
      setBrandDescription(p.brand_description || "");
      setTone(p.tone || "");
      setCaptionStyle(p.caption_style || "polished");
      setTargetAudience(p.target_audience || "");

      // Use the active org (resolved server-side from cookie) to find connections
      if (activeOrgId) {
        const [igResult, fbResult, pendingFbResult] = await Promise.all([
          supabase
            .from("instagram_connections")
            .select("*")
            .eq("organization_id", activeOrgId)
            .maybeSingle(),
          supabase
            .from("facebook_connections")
            .select("*")
            .eq("organization_id", activeOrgId)
            .maybeSingle(),
          supabase
            .from("pending_facebook_tokens")
            .select("facebook_user_id")
            .eq("profile_id", user.id)
            .maybeSingle(),
        ]);
        setInstagram(igResult.data);
        setFacebook(fbResult.data);
        setHasPendingFb(!!pendingFbResult.data);
      }
      setChecking(false);
    }
    load();
  }, [supabase, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        brand_name: brandName,
        brand_description: brandDescription,
        tone,
        caption_style: captionStyle,
        target_audience: targetAudience,
      })
      .eq("id", profile!.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Profile updated!");
      setEditing(false);
    }
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <p className="text-base-content/50">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <AppHeader activeOrgId={activeOrgId} />

      <div className="flex-1 px-4 py-6">
        <div className="w-full max-w-lg mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Account</h1>

          {/* Profile card */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8">
            <h2 className="text-lg font-semibold mb-4">Profile</h2>

            {editing ? (
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-base-content/70 mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-base-content/70 mb-1">
                    Brand Description
                  </label>
                  <textarea
                    value={brandDescription}
                    onChange={(e) => setBrandDescription(e.target.value)}
                    required
                    rows={3}
                    className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-base-content/70 mb-1">
                    Tone / Voice
                  </label>
                  <input
                    type="text"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    required
                    className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-base-content/70 mb-2">
                    Caption Style
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        ["polished", "Polished", "Structured, catchy, emojis & hashtags"],
                        ["casual", "Casual", "Natural, conversational, minimal extras"],
                        ["minimal", "Minimal", "Short & clean, no hashtags or emojis"],
                      ] as const
                    ).map(([value, label, desc]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCaptionStyle(value)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          captionStyle === value
                            ? "border-primary bg-primary/10"
                            : "border-base-300 hover:border-base-content/30"
                        }`}
                      >
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-base-content/50 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-base-content/70 mb-1">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    required
                    className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                {error && (
                  <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
                )}
                {success && (
                  <div className="bg-success/10 text-success rounded-lg p-3 text-sm">{success}</div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-neutral text-neutral-content rounded-lg py-2.5 font-medium hover:bg-neutral/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBrandName(profile?.brand_name || "");
                      setBrandDescription(profile?.brand_description || "");
                      setTone(profile?.tone || "");
                      setCaptionStyle(profile?.caption_style || "polished");
                      setTargetAudience(profile?.target_audience || "");
                      setError("");
                      setSuccess("");
                      setEditing(false);
                    }}
                    className="px-6 rounded-lg border border-base-300 py-2.5 text-sm font-medium text-base-content/70 hover:bg-base-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-base-content/50">Brand Name</p>
                  <p className="text-base-content mt-1">{brandName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-base-content/50">Brand Description</p>
                  <p className="text-base-content mt-1">{brandDescription}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-base-content/50">Tone / Voice</p>
                  <p className="text-base-content mt-1">{tone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-base-content/50">Caption Style</p>
                  <p className="text-base-content mt-1 capitalize">{captionStyle}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-base-content/50">Target Audience</p>
                  <p className="text-base-content mt-1">{targetAudience}</p>
                </div>

                {success && (
                  <div className="bg-success/10 text-success rounded-lg p-3 text-sm">{success}</div>
                )}

                <button
                  onClick={() => {
                    setSuccess("");
                    setEditing(true);
                  }}
                  className="w-full border border-base-300 rounded-lg py-2.5 text-sm font-medium text-base-content/70 hover:bg-base-200 transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>

          {/* Organization connections card */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{activeOrgName || "Organization"}</h2>
              <OrgSwitcher currentOrgId={activeOrgId} compact />
            </div>
            <p className="text-sm text-base-content/50 mb-6">
              Social accounts linked to this organization.
            </p>

            {/* Instagram */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-base-content/70 mb-2">Instagram</h3>
              {igError && (
                <div className="bg-error/10 text-error rounded-lg p-3 text-sm mb-3">{igError}</div>
              )}
              {instagram ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">@{instagram.instagram_username || "Connected"}</p>
                      <p className="text-sm text-base-content/50">
                        Connected {new Date(instagram.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href="/api/instagram/auth"
                      className="text-sm text-primary font-medium hover:underline"
                    >
                      Reconnect
                    </a>
                  </div>
                  {needsReauth(instagram.granted_scopes, REQUIRED_INSTAGRAM_SCOPES) && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center justify-between gap-3">
                      <p className="text-sm text-warning">
                        New permissions required. Please re-authorize to continue using all
                        features.
                      </p>
                      <a
                        href="/api/instagram/auth"
                        className="shrink-0 text-sm font-medium text-warning hover:underline"
                      >
                        Re-authorize
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <a
                  href="/api/instagram/auth"
                  className="inline-block bg-gradient-to-r from-secondary to-primary text-neutral-content rounded-lg px-6 py-2.5 font-medium hover:opacity-90 transition-opacity"
                >
                  Connect Instagram
                </a>
              )}
            </div>

            {/* Facebook */}
            <div>
              <h3 className="text-sm font-medium text-base-content/70 mb-2">Facebook</h3>
              {fbError && (
                <div className="bg-error/10 text-error rounded-lg p-3 text-sm mb-3">{fbError}</div>
              )}
              {facebook ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{facebook.page_name || "Connected"}</p>
                      <p className="text-sm text-base-content/50">
                        Connected {new Date(facebook.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href="/api/facebook/auth"
                      className="text-sm text-info font-medium hover:underline"
                    >
                      Reconnect
                    </a>
                  </div>
                  {needsReauth(facebook.granted_scopes, REQUIRED_FACEBOOK_SCOPES) && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center justify-between gap-3">
                      <p className="text-sm text-warning">
                        New permissions required. Please re-authorize to continue using all
                        features.
                      </p>
                      <a
                        href="/api/facebook/auth"
                        className="shrink-0 text-sm font-medium text-warning hover:underline"
                      >
                        Re-authorize
                      </a>
                    </div>
                  )}
                </div>
              ) : hasPendingFb ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Connected</p>
                      <p className="text-sm text-base-content/50">No Facebook Page selected</p>
                    </div>
                    <a
                      href="/api/facebook/auth"
                      className="text-sm text-info font-medium hover:underline"
                    >
                      Reconnect
                    </a>
                  </div>
                </div>
              ) : (
                <a
                  href="/api/facebook/auth"
                  className="inline-block bg-info text-neutral-content rounded-lg px-6 py-2.5 font-medium hover:bg-info/80 transition-colors"
                >
                  Connect Facebook
                </a>
              )}
            </div>
          </div>

          {/* New Organization */}
          <NewOrgForm />

          {profile?.phone && (
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8">
              <h2 className="text-lg font-semibold mb-2">Phone</h2>
              <p className="text-base-content/60">{profile.phone}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewOrgForm() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/org/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        // API auto-switches to the new org via cookie — reload to show it
        window.location.reload();
      } else {
        const data = await res.json();
        setCreateError(data.error || "Failed to create organization.");
        setCreating(false);
      }
    } catch {
      setCreateError("Something went wrong. Please try again.");
      setCreating(false);
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full border border-dashed border-base-300 rounded-2xl py-4 text-sm font-medium text-base-content/50 hover:text-base-content/70 hover:border-base-content/30 transition-colors"
      >
        + New Organization
      </button>
    );
  }

  return (
    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8">
      <h2 className="text-lg font-semibold mb-4">New Organization</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-base-content/70 mb-1">
            Organization Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoFocus
            placeholder="e.g. Pizza Planet"
            className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>
        {createError && (
          <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{createError}</div>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={creating}
            className="flex-1 bg-neutral text-neutral-content rounded-lg py-2.5 font-medium hover:bg-neutral/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setName("");
              setCreateError("");
            }}
            className="px-6 rounded-lg border border-base-300 py-2.5 text-sm font-medium text-base-content/70 hover:bg-base-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
