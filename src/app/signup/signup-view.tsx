"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";

type Step = "email" | "password" | "emailSent";

let zxcvbnInitialized = false;

const STRENGTH_CONFIG = [
  { label: "Weak", color: "bg-error" },
  { label: "Weak", color: "bg-error" },
  { label: "Fair", color: "bg-warning" },
  { label: "Strong", color: "bg-success" },
  { label: "Strong", color: "bg-success" },
] as const;

type Score = 0 | 1 | 2 | 3 | 4;

function PasswordStrengthMeter({ score }: { score: Score }) {
  const { label, color } = STRENGTH_CONFIG[score];
  const filledSegments = score === 0 ? 1 : score;

  return (
    <div className="mt-2">
      <div
        className="flex gap-1"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-label={`Password strength: ${label}`}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < filledSegments ? color : "bg-base-300"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-base-content/50">
        Password strength:{" "}
        <span className={score <= 1 ? "text-error" : score === 2 ? "text-warning" : "text-success"}>
          {label}
        </span>
      </p>
    </div>
  );
}

export default function SignupView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <p className="text-base-content/50">Loading...</p>
        </div>
      }
    >
      <SignupFlow />
    </Suspense>
  );
}

function SignupFlow() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [confirmedMessage, setConfirmedMessage] = useState(false);
  const [strength, setStrength] = useState<Score | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!password) {
      setStrength(null);
      return;
    }

    let cancelled = false;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const [{ zxcvbn, zxcvbnOptions }, commonPkg, enPkg] = await Promise.all([
        import("@zxcvbn-ts/core"),
        import("@zxcvbn-ts/language-common"),
        import("@zxcvbn-ts/language-en"),
      ]);

      if (!zxcvbnInitialized) {
        zxcvbnOptions.setOptions({
          translations: enPkg.translations,
          graphs: commonPkg.adjacencyGraphs,
          dictionary: {
            ...commonPkg.dictionary,
            ...enPkg.dictionary,
          },
        });
        zxcvbnInitialized = true;
      }

      if (!cancelled) {
        setStrength(zxcvbn(password).score as Score);
      }
    }, 150);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [password]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      const { status } = await res.json();

      if (status === "new") {
        setStep("password");
      } else if (status === "unconfirmed") {
        setStep("emailSent");
      } else if (status === "confirmed") {
        setConfirmedMessage(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    try {
      let phone: string | null = null;

      if (token) {
        const res = await fetch("/api/auth/validate-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Invalid or expired signup link.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        phone = data.phone;
      }

      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { phone, registration_token: token },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Sign in immediately since email confirmation is disabled
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Create the user's profile
      const profileRes = await fetch("/api/auth/create-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!profileRes.ok) {
        const data = await profileRes.json();
        setError(data.error || "Failed to create profile.");
        setLoading(false);
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendSuccess(false);
    setError("");
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (resendError) {
      setError(resendError.message);
    } else {
      setResendSuccess(true);
    }
  }

  if (step === "emailSent") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <Image src="/postimp_logo.png" alt="" width={80} height={90} className="h-20 w-auto" />
            <span className="text-4xl font-[family-name:var(--font-logo)] mt-2">Post Imp</span>
          </div>
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8 text-center">
            <div className="text-4xl mb-4">📬</div>
            <h1 className="text-2xl font-bold mb-2">Check your email</h1>
            <p className="text-base-content/50 mb-6">
              We sent a confirmation link to{" "}
              <span className="font-medium text-base-content">{email}</span>.
              <br />
              Click the link to activate your account.
            </p>
            {resendSuccess && (
              <div className="bg-success/10 text-success rounded-lg p-3 text-sm mb-4">
                Confirmation email resent!
              </div>
            )}
            {error && (
              <div className="bg-error/10 text-error rounded-lg p-3 text-sm mb-4">{error}</div>
            )}
            <p className="text-sm text-base-content/40">
              Didn&apos;t get it? Check your spam folder or{" "}
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-primary font-medium hover:underline disabled:opacity-50"
              >
                {resending ? "Sending..." : "resend the email"}
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image src="/postimp_logo.png" alt="" width={80} height={90} className="h-20 w-auto" />
          <span className="text-4xl font-[family-name:var(--font-logo)] mt-2">Post Imp</span>
        </div>
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Join Post Imp</h1>
          <p className="text-base-content/50 text-center mb-8">
            {step === "email"
              ? "Enter your email to get started"
              : "Create a password for your account"}
          </p>

          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-base-content/70 mb-1"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="you@example.com"
                />
              </div>

              {confirmedMessage && (
                <div className="bg-info/10 text-info rounded-lg p-3 text-sm">
                  You already have an account.{" "}
                  <Link href="/login" className="font-medium underline">
                    Log in instead
                  </Link>
                </div>
              )}

              {error && (
                <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral text-neutral-content rounded-lg py-2.5 font-medium hover:bg-neutral/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="bg-base-200 rounded-lg px-4 py-2.5 text-sm text-base-content/60">
                {email}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-base-content/70 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="At least 6 characters"
                />
                {strength !== null && <PasswordStrengthMeter score={strength} />}
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-base-content/70 mb-1"
                >
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-base-300 px-4 py-2.5 text-base-content focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="Re-enter your password"
                />
              </div>

              {token && (
                <div className="flex items-start gap-3">
                  <input
                    id="sms-consent"
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    required
                    className="mt-1 h-4 w-4 rounded border-base-300 text-primary focus:ring-primary"
                  />
                  <label
                    htmlFor="sms-consent"
                    className="text-xs text-base-content/50 leading-relaxed"
                  >
                    By signing up, you consent to receive SMS messages from Post Imp (e.g. draft
                    captions, post confirmations, account notifications). Consent is not a condition
                    of purchase. Msg &amp; data rates may apply. Msg frequency varies. Reply STOP to
                    unsubscribe at any time. Reply HELP for assistance.{" "}
                    <Link href="/privacy" className="underline">
                      Privacy Policy
                    </Link>{" "}
                    &amp;{" "}
                    <Link href="/terms" className="underline">
                      Terms of Service
                    </Link>
                    .
                  </label>
                </div>
              )}

              {error && (
                <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || (!!token && !smsConsent)}
                className="w-full bg-neutral text-neutral-content rounded-lg py-2.5 font-medium hover:bg-neutral/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating account..." : "Sign Up"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setPassword("");
                  setConfirmPassword("");
                  setError("");
                  setStrength(null);
                }}
                className="w-full text-sm text-base-content/50 hover:text-base-content/70 transition-colors"
              >
                &larr; Back
              </button>
            </form>
          )}

          <p className="text-center text-sm text-base-content/50 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
