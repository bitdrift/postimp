import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="text-xl font-[family-name:var(--font-logo)]">Post Imp</span>
        <div className="flex gap-4">
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
      <main className="max-w-5xl mx-auto px-6 pt-20 pb-32">
        <div className="max-w-2xl">
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            Post to Instagram
            <br />
            <span className="text-gray-400">by texting.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-lg">
            Send a photo via SMS, get an AI-crafted caption back. Approve it and
            it goes live on your Instagram. That simple.
          </p>
          <div className="mt-10 flex gap-4">
            <Link
              href="/signup"
              className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-32">
          <h2 className="text-2xl font-bold mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold">
                1
              </div>
              <h3 className="font-semibold text-lg">Text a photo</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Send a photo with a brief description to our number. We handle
                the rest.
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold">
                2
              </div>
              <h3 className="font-semibold text-lg">Review your draft</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                AI generates an on-brand caption. Preview it, request changes,
                or approve it.
              </p>
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold">
                3
              </div>
              <h3 className="font-semibold text-lg">Publish</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Reply &ldquo;approve&rdquo; and your post goes live on
                Instagram. Done.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-gray-400">
          <span className="font-[family-name:var(--font-logo)]">Post Imp</span>
          <span>postimp.com</span>
        </div>
      </footer>
    </div>
  );
}
