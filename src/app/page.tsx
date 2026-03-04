import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <span className="text-xl font-[family-name:var(--font-logo)]">Post Imp</span>
        <div className="flex items-center gap-4">
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
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="text-center max-w-xl">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
            Your social media manager
            <br />
            <span className="text-gray-400">works for peanuts.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-500 leading-relaxed">
            AI that sounds like you, posts for you, and never asks for a raise.
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
