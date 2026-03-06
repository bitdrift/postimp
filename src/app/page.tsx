import Link from "next/link";

const steps = [
  {
    number: "1",
    title: "Send a photo",
    description: "Upload an image and add a quick note about what you want to say.",
  },
  {
    number: "2",
    title: "Review your caption",
    description: "AI drafts an on-brand caption for you in seconds.",
  },
  {
    number: "3",
    title: "Publish",
    description: "One tap and your post goes live on Instagram.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="max-w-5xl mx-auto px-6 py-6 w-full flex items-center justify-between shrink-0">
        <span className="text-3xl sm:text-4xl font-[family-name:var(--font-logo)] leading-none translate-y-1.5">
          Post Imp
        </span>
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

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-16 pb-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Professional Instagram posts.
              <br />
              <span className="text-pink">A fraction of the cost.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed">
              Skip the agency. Send a photo, approve your caption, and Post Imp handles the rest.
            </p>
            <Link
              href="/signup"
              className="inline-block mt-10 bg-black text-white px-8 py-3.5 rounded-full font-medium hover:bg-gray-800 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t bg-gray-50">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <div className="grid sm:grid-cols-3 gap-10">
              {steps.map((step) => (
                <div key={step.number}>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-pink">{step.number}</span>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-gray-500 mt-2 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
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
