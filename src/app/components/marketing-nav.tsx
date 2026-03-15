import Link from "next/link";
import ImpLoader from "@/app/components/imp-loader";

export default function MarketingNav() {
  return (
    <nav className="max-w-5xl mx-auto px-6 py-6 w-full flex items-center justify-between shrink-0">
      <span className="flex items-center gap-2">
        <div className="-mx-8">
          <ImpLoader size={115} />
        </div>
        <Link
          href="/"
          className="text-3xl sm:text-4xl font-[family-name:var(--font-logo)] leading-none translate-y-1.5"
        >
          Post Imp
        </Link>
      </span>
      <div className="flex items-center gap-4">
        <Link
          href="/learn"
          className="text-sm text-base-content/60 hover:text-base-content transition-colors"
        >
          Learn
        </Link>
        <Link
          href="/login"
          className="text-sm text-base-content/60 hover:text-base-content transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="text-sm bg-neutral text-neutral-content px-4 py-2 rounded-lg hover:bg-neutral/80 transition-colors"
        >
          Sign up
        </Link>
      </div>
    </nav>
  );
}
