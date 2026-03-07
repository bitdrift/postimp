"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImpLoader from "@/app/components/imp-loader";

export default function OnboardingView() {
  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [tone, setTone] = useState("");
  const [captionStyle, setCaptionStyle] = useState<"polished" | "casual" | "minimal">("polished");
  const [targetAudience, setTargetAudience] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile?.onboarding_completed) {
        router.push("/posts");
        return;
      }

      if (profile) {
        setBrandName(profile.brand_name || "");
        setBrandDescription(profile.brand_description || "");
        setTone(profile.tone || "");
        setCaptionStyle(profile.caption_style || "polished");
        setTargetAudience(profile.target_audience || "");
      }
      setChecking(false);
    }
    checkProfile();
  }, [supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        brand_name: brandName,
        brand_description: brandDescription,
        tone,
        caption_style: captionStyle,
        target_audience: targetAudience,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/posts");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ImpLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Set Up Your Brand</h1>
          <p className="text-gray-500 text-center mb-8">
            Tell us about your brand so we can craft the perfect posts
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="brandName" className="block text-sm font-medium text-gray-700 mb-1">
                Brand Name
              </label>
              <input
                id="brandName"
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-pink focus:border-transparent outline-none"
                placeholder="Your Brand"
              />
            </div>

            <div>
              <label
                htmlFor="brandDescription"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                What does your brand do?
              </label>
              <textarea
                id="brandDescription"
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                required
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-pink focus:border-transparent outline-none resize-none"
                placeholder="We sell handmade candles inspired by nature..."
              />
            </div>

            <div>
              <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-1">
                Brand Voice / Tone
              </label>
              <input
                id="tone"
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-pink focus:border-transparent outline-none"
                placeholder="Friendly, witty, professional..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Caption Style</label>
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
              <label
                htmlFor="targetAudience"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Target Audience
              </label>
              <input
                id="targetAudience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-pink focus:border-transparent outline-none"
                placeholder="Women aged 25-40 who love home decor..."
              />
            </div>

            {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white rounded-lg py-2.5 font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
