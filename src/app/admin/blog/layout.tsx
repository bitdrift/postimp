import Link from "next/link";

export default function AdminBlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <header className="border-b border-base-300 px-6 py-3 flex items-center justify-between">
        <nav className="flex items-center gap-6">
          <Link href="/admin/blog" className="text-sm font-semibold hover:text-primary transition-colors">
            Articles
          </Link>
          <Link
            href="/admin/blog/write"
            className="text-sm font-medium text-base-content/60 hover:text-primary transition-colors"
          >
            Write New
          </Link>
        </nav>
        <Link href="/posts" className="text-sm text-base-content/40 hover:text-base-content/60 transition-colors">
          Back to app
        </Link>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
