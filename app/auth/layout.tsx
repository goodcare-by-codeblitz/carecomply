import { TopNav } from '@/components/marketing/nav';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
