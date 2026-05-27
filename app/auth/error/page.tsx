import Link from 'next/link';
import { AlertTriangle, Lock } from 'lucide-react';
import { Container } from '@/components/marketing/ui/container';
import { Suspense } from 'react';

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;
  return params?.error ? (
    <p className="mt-3 text-[13px] font-mono bg-surface-page border border-line rounded-lg px-3 py-2 text-slate-600 break-all">
      {params.error}
    </p>
  ) : (
    <p className="mt-3 text-[14px] text-slate-600">An unspecified error occurred.</p>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface-page flex flex-col items-center justify-center py-12">
      <Container className="w-full">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-line bg-white p-8 shadow-card">
            <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 grid place-items-center mb-5">
              <AlertTriangle size={22} style={{ width: 22, height: 22 }} />
            </div>
            <h1 className="text-[24px] font-semibold tracking-ultratight text-ink">
              Sorry, something went wrong.
            </h1>
            <Suspense>
              <ErrorContent searchParams={searchParams} />
            </Suspense>
            <Link
              href="/auth/login"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand text-white px-6 text-[14px] font-medium hover:bg-brand-700 transition">
              Back to sign in
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-2 text-[12px] text-slate-500">
            <Lock size={13} style={{ width: 13, height: 13 }} />
            <span>Encrypted in transit · UK-hosted · ICO-registered</span>
          </div>
        </div>
      </Container>
    </div>
  );
}
