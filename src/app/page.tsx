import Link from "next/link";
import RotatingHeadline from "@/app/components/rotating-headline";
import MarketingNav from "@/app/components/marketing-nav";
import MarketingFooter from "@/app/components/marketing-footer";

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
    <div className="min-h-screen bg-base-100 flex flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-16 pb-24">
          <div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.2]">
              <span className="text-primary">
                <RotatingHeadline />
              </span>
            </h1>
            <p className="mt-6 text-lg text-base-content/50 leading-relaxed">
              Send your photos, approve the results, and let Post Imp handle the rest.
            </p>
            <Link
              href="/signup"
              className="inline-block mt-10 bg-neutral text-neutral-content px-8 py-3.5 rounded-full font-medium hover:bg-neutral/80 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-base-300 bg-base-200">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <div className="grid sm:grid-cols-3 gap-10">
              {steps.map((step) => (
                <div key={step.number}>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-primary">{step.number}</span>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-base-content/50 mt-2 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
