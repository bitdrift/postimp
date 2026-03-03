"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let phone: string | null = null;

      // If token provided, validate it and get phone number (SMS signup)
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

      // Create Supabase auth user
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

      setEmailSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <div className="text-4xl mb-4">📬</div>
            <h1 className="text-2xl font-bold mb-2">Check your email</h1>
            <p className="text-gray-500 mb-6">
              We sent a confirmation link to{" "}
              <span className="font-medium text-gray-900">{email}</span>.
              <br />
              Click the link to activate your account.
            </p>
            <p className="text-sm text-gray-400">
              Didn&apos;t get it? Check your spam folder or{" "}
              <button
                onClick={() => setEmailSent(false)}
                className="text-black font-medium hover:underline"
              >
                try again
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h1 className="text-2xl font-bold text-center mb-2">
            Join Post Imp
          </h1>
          <p className="text-gray-500 text-center mb-8">
            Create your account to start posting
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                placeholder="At least 6 characters"
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
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <label htmlFor="sms-consent" className="text-xs text-gray-500 leading-relaxed">
                  By signing up, you consent to receive SMS messages from Post Imp
                  (e.g. draft captions, post confirmations, account notifications).
                  Consent is not a condition of purchase. Msg &amp; data rates may
                  apply. Msg frequency varies. Reply STOP to unsubscribe at any
                  time. Reply HELP for assistance.{" "}
                  <Link href="/privacy" className="underline">Privacy Policy</Link>
                  {" "}&amp;{" "}
                  <Link href="/terms" className="underline">Terms of Service</Link>.
                </label>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!!token && !smsConsent)}
              className="w-full bg-black text-white rounded-lg py-2.5 font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-black font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
