import { getUserOrganizationsResult } from '@/lib/orgs';
import { getPlatformAccessForUser } from '@/lib/platform-admin';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Building2, ArrowRight } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { TopNav } from '@/components/marketing/nav';
import { Container } from '@/components/marketing/ui/container';

async function selectOrganization(formData: FormData) {
  'use server';

  const slug = formData.get('slug');
  if (typeof slug !== 'string' || !slug) {
    redirect('/select-org');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { redirect('/auth/login'); }

  const organizationsResult = await getUserOrganizationsResult(supabase, user.id);
  if (!organizationsResult.ok) { redirect('/select-org?error=org_lookup_failed'); }

  const organizations = organizationsResult.organizations;
  const organization = organizations.find((org) => org.slug === slug);
  if (!organization) { redirect('/select-org'); }

  const cookieStore = await cookies();
  cookieStore.set('current_org_slug', organization.slug, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
  });

  redirect(`/${organization.slug}/dashboard`);
}

async function SelectOrgContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { redirect('/auth/login'); }

  const admin = createAdminClient();
  const platformAccess = await getPlatformAccessForUser(admin, user.id);
  if (platformAccess.canAccessAdmin) { redirect('/admin/reminders'); }

  const organizationsResult = await getUserOrganizationsResult(supabase, user.id);

  if (!organizationsResult.ok) {
    return (
      <>
        <TopNav />
        <div className="min-h-[calc(100vh-64px)] bg-surface-page flex flex-col items-center justify-center py-12">
          <Container className="w-full">
            <div className="w-full max-w-lg">
              <div className="rounded-2xl border border-line bg-white p-8 shadow-card">
                <h1 className="text-[24px] font-semibold tracking-ultratight text-ink">Organizations unavailable</h1>
                <p className="mt-2 text-[14.5px] text-slate-600">Your organizations could not be loaded. Please refresh and try again.</p>
              </div>
            </div>
          </Container>
        </div>
      </>
    );
  }

  const organizations = organizationsResult.organizations;
  if (organizations.length === 0) { redirect('/create-org'); }
  if (organizations.length === 1) { redirect(`/${organizations[0].slug}/dashboard`); }

  return (
    <>
      <TopNav />
      <div className="min-h-[calc(100vh-64px)] bg-surface-page flex flex-col items-center justify-center py-12">
        <Container className="w-full">
          <div className="w-full max-w-lg">
            <div className="rounded-2xl border border-line bg-white p-8 shadow-card">
              <h1 className="text-[28px] font-semibold tracking-ultratight text-ink">Select a workspace.</h1>
              <p className="mt-2 text-[14.5px] text-slate-600 mb-6">Choose which organization to open.</p>

              <div className="space-y-3">
                {organizations.map((organization) => (
                  <form key={organization.id} action={selectOrganization}>
                    <input type="hidden" name="slug" value={organization.slug} />
                    <button
                      type="submit"
                      className="w-full flex items-center gap-4 rounded-xl border border-line bg-surface-page p-4 hover:border-ink hover:bg-white transition text-left group">
                      <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                        <Building2 size={18} style={{ width: 18, height: 18 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-ink truncate">{organization.name}</div>
                        <div className="text-[12px] text-slate-500 mt-0.5">/{organization.slug}</div>
                      </div>
                      <ArrowRight size={16} className="text-slate-400 group-hover:text-ink transition shrink-0" style={{ width: 16, height: 16 }} />
                    </button>
                  </form>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}

export default function SelectOrgPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-page" />}>
      <SelectOrgContent />
    </Suspense>
  );
}
