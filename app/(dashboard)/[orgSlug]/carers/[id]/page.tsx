import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail, Phone, FileText } from 'lucide-react'
import Link from 'next/link'
import { DocumentUploader } from '@/components/document-uploader'
import { InviteLinkCard } from '@/components/invite-link-card'
import { resolveOrgAccess } from '@/lib/orgs'
import { isInvitationSetupMissing } from '@/lib/invitations'

interface CarerPageProps {
  params: Promise<{ id: string; orgSlug: string }>
}

export default async function CarerPage({ params }: CarerPageProps) {
  const { id, orgSlug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  const currentOrg = await resolveOrgAccess(supabase, user.id, orgSlug)

  if (!currentOrg) {
    notFound()
  }

  const { data: carer } = await supabase
    .from('carers')
    .select('*')
    .eq('id', id)
    .eq('organization_id', currentOrg.id)
    .single()

  if (!carer) {
    notFound()
  }

  const { data: invitation, error: invitationError } = await supabase
    .from('organization_invitations')
    .select('id, token, expires_at, status')
    .eq('organization_id', currentOrg.id)
    .eq('invite_type', 'carer')
    .eq('carer_id', carer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invitationError && !isInvitationSetupMissing(invitationError)) {
    console.error('Failed to load carer invitation:', invitationError)
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('*, document_types(name, description)')
    .eq('carer_id', id)
    .order('uploaded_at', { ascending: false })

  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('*')
    .eq('organization_id', currentOrg.id)
    .order('name')

  const initials = carer.full_name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back link */}
      <Link 
        href={`/${orgSlug}/carers`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to carers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <span className="text-xl font-semibold">{initials}</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{carer.full_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                {carer.email}
              </span>
              {carer.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  {carer.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${
          carer.status === 'active' 
            ? 'bg-green-50 text-green-700' 
            : carer.status === 'pending'
            ? 'bg-amber-50 text-amber-700'
            : carer.status === 'expired'
            ? 'bg-red-50 text-red-700'
            : 'bg-muted text-muted-foreground'
        }`}>
          {carer.status.charAt(0).toUpperCase() + carer.status.slice(1)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Documents list */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>
                Uploaded compliance documents for this carer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{doc.document_types?.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {doc.expiry_date && (
                          <span className="text-xs text-muted-foreground">
                            Expires {new Date(doc.expiry_date).toLocaleDateString()}
                          </span>
                        )}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          doc.status === 'approved' 
                            ? 'bg-green-50 text-green-700' 
                            : doc.status === 'pending'
                            ? 'bg-amber-50 text-amber-700'
                            : doc.status === 'rejected'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                        <Button variant="ghost" size="sm" asChild>
                          <a 
                            href={`/api/file?pathname=${encodeURIComponent(doc.file_path)}`} 
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upload sidebar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invite link card */}
          <InviteLinkCard 
            inviteId={invitation?.id}
            inviteToken={invitation?.token}
            inviteExpiresAt={invitation?.expires_at}
            inviteStatus={invitation?.status}
            carerName={carer.full_name}
            carerEmail={carer.email}
          />
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload Document</CardTitle>
              <CardDescription>
                Add a new compliance document for this carer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUploader 
                carerId={carer.id} 
                documentTypes={documentTypes || []} 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
