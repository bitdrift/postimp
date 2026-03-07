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
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <ImpLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Set Up Your Brand</h1>
          <p className="text-base-content/50 text-center mb-8">
            Tell us about your brand so we can craft the perfect posts
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="brandName"
                className="block text-sm font-medium text-base-content/70 mb-1"
              >
                Brand Name
              </label>
              <input
                id="brandName"
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
                className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="Your Brand"
              />
            </div>

            <div>
              <label
                htmlFor="brandDescription"
                className="block text-sm font-medium text-base-content/70 mb-1"
              >
                What does your brand do?
              </label>
              <textarea
                id="brandDescription"
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                required
                rows={3}
                className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                placeholder="We sell handmade candles inspired by nature..."
              />
            </div>

            <div>
              <label htmlFor="tone" className="block text-sm font-medium text-base-content/70 mb-1">
                Brand Voice / Tone
              </label>
              <input
                id="tone"
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                required
                className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="Friendly, witty, professional..."
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
              <label
                htmlFor="targetAudience"
                className="block text-sm font-medium text-base-content/70 mb-1"
              >
                Target Audience
              </label>
              <input
                id="targetAudience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                required
                className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="Women aged 25-40 who love home decor..."
              />
            </div>

            {error && <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral text-neutral-content rounded-lg py-2.5 font-medium hover:bg-neutral/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
