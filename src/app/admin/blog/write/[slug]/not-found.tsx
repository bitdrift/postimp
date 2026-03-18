import Link from "next/link";

export default function WriteDraftNotFound() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-16 text-center">
      <h1 className="text-3xl font-bold">Draft not found</h1>
      <p className="mt-4 text-base-content/50">
        This draft doesn&apos;t exist or may have been published under a different slug.
      </p>
      <Link
        href="/admin/blog/write"
        className="inline-block mt-8 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        &larr; Write a new article
      </Link>
    </section>
  );
}
