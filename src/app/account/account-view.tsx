"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/db/profiles";
import type { InstagramConnection } from "@/lib/db/instagram";
import type { FacebookConnection } from "@/lib/db/facebook";

export default function AccountView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}

function AccountContent() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [instagram, setInstagram] = useState<InstagramConnection | null>(null);
  const [facebook, setFacebook] = useState<FacebookConnection | null>(null);
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

      const [{ data: ig }, { data: fb }] = await Promise.all([
        supabase.from("instagram_connections").select("*").eq("profile_id", user.id).maybeSingle(),
        supabase.from("facebook_connections").select("*").eq("profile_id", user.id).maybeSingle(),
      ]);

      setInstagram(ig);
      setFacebook(fb);
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="w-full max-w-lg mx-auto space-y-6">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Account</h1>
          <div className="flex items-center gap-4">
            <Link href="/posts" className="text-sm text-gray-500 hover:text-gray-700">
              Posts
            </Link>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">
              Log out
            </button>
          </div>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-pink focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand Description
                </label>
                <textarea
                  value={brandDescription}
                  onChange={(e) => setBrandDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-pink focus:border-transparent outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tone / Voice</label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-pink focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                          ? "border-pink bg-pink-light"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-pink focus:border-transparent outline-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>
              )}
              {success && (
                <div className="bg-green-50 text-green-700 rounded-lg p-3 text-sm">{success}</div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-black text-white rounded-lg py-2.5 font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  className="px-6 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-500">Brand Name</p>
                <p className="text-gray-900 mt-1">{brandName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Brand Description</p>
                <p className="text-gray-900 mt-1">{brandDescription}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Tone / Voice</p>
                <p className="text-gray-900 mt-1">{tone}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Caption Style</p>
                <p className="text-gray-900 mt-1 capitalize">{captionStyle}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Target Audience</p>
                <p className="text-gray-900 mt-1">{targetAudience}</p>
              </div>

              {success && (
                <div className="bg-green-50 text-green-700 rounded-lg p-3 text-sm">{success}</div>
              )}

              <button
                onClick={() => {
                  setSuccess("");
                  setEditing(true);
                }}
                className="w-full border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-lg font-semibold mb-4">Instagram Connection</h2>
          {igError && (
            <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4">{igError}</div>
          )}
          {instagram ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">@{instagram.instagram_username || "Connected"}</p>
                <p className="text-sm text-gray-500">
                  Connected {new Date(instagram.created_at).toLocaleDateString()}
                </p>
              </div>
              <a
                href="/api/instagram/auth"
                className="text-sm text-pink font-medium hover:underline"
              >
                Reconnect
              </a>
            </div>
          ) : (
            <a
              href="/api/instagram/auth"
              className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg px-6 py-2.5 font-medium hover:opacity-90 transition-opacity"
            >
              Connect Instagram
            </a>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-lg font-semibold mb-4">Facebook Connection</h2>
          {fbError && (
            <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4">{fbError}</div>
          )}
          {facebook ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{facebook.page_name || "Connected"}</p>
                <p className="text-sm text-gray-500">
                  Connected {new Date(facebook.created_at).toLocaleDateString()}
                </p>
              </div>
              <a
                href="/api/facebook/auth"
                className="text-sm text-blue-600 font-medium hover:underline"
              >
                Reconnect
              </a>
            </div>
          ) : (
            <a
              href="/api/facebook/auth"
              className="inline-block bg-blue-600 text-white rounded-lg px-6 py-2.5 font-medium hover:bg-blue-700 transition-colors"
            >
              Connect Facebook
            </a>
          )}
        </div>

        {profile?.phone && (
          <div className="bg-white rounded-2xl shadow-sm border p-8">
            <h2 className="text-lg font-semibold mb-2">Phone</h2>
            <p className="text-gray-600">{profile.phone}</p>
          </div>
        )}
      </div>
    </div>
  );
}
