import { TopNav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="flex-1 min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
