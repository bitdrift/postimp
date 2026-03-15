import MarketingNav from "@/app/components/marketing-nav";
import MarketingFooter from "@/app/components/marketing-footer";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
