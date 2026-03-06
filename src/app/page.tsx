import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="max-w-5xl mx-auto px-6 py-6 w-full flex items-center justify-between shrink-0">
        <span className="text-3xl sm:text-4xl font-[family-name:var(--font-logo)] leading-none translate-y-1.5">
          Post Imp
        </span>
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

      <main className="flex-1 flex items-center">
        <div className="max-w-5xl mx-auto px-6 w-full">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Better social posts.
              <br />
              <span className="text-pink">A fraction of the cost.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed">
              An AI powered Social Media Manager that sounds like you, posts for you, and never asks
              for a raise.
            </p>
            <Link
              href="/signup"
              className="inline-block mt-10 bg-black text-white px-8 py-3.5 rounded-full font-medium hover:bg-gray-800 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Post Imp</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">
              Terms
            </Link>
            <a href="mailto:support@postimp.com" className="hover:text-gray-600 transition-colors">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
