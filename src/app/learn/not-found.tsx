import Link from "next/link";

export default function LearnNotFound() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-16 text-center">
      <h1 className="text-3xl font-bold">Article not found</h1>
      <p className="mt-4 text-base-content/50">
        The article you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Link
        href="/learn"
        className="inline-block mt-8 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        &larr; Back to Learn
      </Link>
    </section>
  );
}
