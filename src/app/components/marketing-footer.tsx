import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-base-300 shrink-0">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-base-content/40">
        <p>&copy; {new Date().getFullYear()} Post Imp</p>
        <div className="flex items-center gap-6">
          <Link href="/learn" className="hover:text-base-content/60 transition-colors">
            Learn
          </Link>
          <Link href="/privacy" className="hover:text-base-content/60 transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-base-content/60 transition-colors">
            Terms
          </Link>
          <a
            href="mailto:support@postimp.com"
            className="hover:text-base-content/60 transition-colors"
          >
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
