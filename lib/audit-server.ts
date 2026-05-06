// Server-side audit logging - uses Supabase server client directly
import { createClient } from '@/lib/supabase/server'
import type { AuditAction, EntityType } from './audit'
import { resolveOrgAccess } from './orgs'
import { cookies } from 'next/headers'

interface ServerAuditLogParams {
  action: AuditAction
  entityType: EntityType
  entityId?: string
  entityName?: string
  details?: Record<string, unknown>
  request?: Request
}

export async function createAuditLog(params: ServerAuditLogParams) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const cookieStore = await cookies()
    const orgSlug = cookieStore.get('current_org_slug')?.value
    const organization = orgSlug
      ? await resolveOrgAccess(supabase, user.id, orgSlug)
      : null

    if (!organization) return null

    // Extract request info if available
    let ipAddress: string | null = null
    let userAgent: string | null = null
    
    if (params.request) {
      ipAddress = params.request.headers.get('x-forwarded-for')?.split(',')[0] || 
                  params.request.headers.get('x-real-ip') || 
                  null
      userAgent = params.request.headers.get('user-agent')
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        user_email: user.email,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        details: params.details || {},
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create audit log:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Audit log error:', error)
    return null
  }
}
