import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <span className="text-xl font-[family-name:var(--font-logo)] ">Post Imp</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-black transition-colors">
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
      <main className="flex-1 flex items-center justify-start px-6 pb-20">
        <div className="max-w-5xl mx-auto w-full">
          <div className="text-left max-w-2xl">
            <div className="flex items-center gap-6 sm:gap-8">
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
                Better social posts.
                <br />
                <span className="text-gray-400">A fraction of the cost.</span>
              </h1>
              <Image
                src="/postimp_logo.png"
                alt=""
                width={140}
                height={140}
                className="rounded-2xl shrink-0"
              />
            </div>
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
        </div>
      </main>
    </div>
  );
}
