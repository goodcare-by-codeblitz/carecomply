import Link from 'next/link';
import { Mail, Lock } from 'lucide-react';
import { Container } from '@/components/marketing/ui/container';

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface-page flex flex-col items-center justify-center py-12">
      <Container className="w-full">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-line bg-white p-8 shadow-card text-center">
            <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center">
              <Mail size={24} style={{ width: 24, height: 24 }} />
            </div>
            <h1 className="text-[24px] font-semibold tracking-ultratight text-ink">Check your email</h1>
            <p className="mt-3 text-[14.5px] text-slate-600 leading-[1.6] max-w-xs mx-auto">
              We've sent you a confirmation link. Click it to activate your CareComply account and enter your workspace.
            </p>
            <Link
              href="/auth/login"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-white px-6 text-[14px] font-medium text-ink hover:bg-surface-page transition">
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
