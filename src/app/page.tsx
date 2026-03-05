import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white relative">
      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 pt-6">
        <div className="flex items-start justify-between mb-6">
          <p className="text-3xl sm:text-4xl font-[family-name:var(--font-logo)]">Post Imp</p>
          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-black transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
        <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Better social posts.
              <br />
              <span className="text-gray-400">A fraction of the cost.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed">
              An AI powered Social Media Manager that sounds like you, posts for you, and never asks
              for a raise.
            </p>
            <div className="mt-10">
              <Link
                href="/signup"
                className="inline-block bg-black text-white px-8 py-3.5 rounded-full font-medium hover:bg-gray-800 transition-colors text-base"
              >
                Get Started
              </Link>
            </div>
        </div>
      </main>
    </div>
  );
}
