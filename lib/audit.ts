// Client-side audit logging - calls API endpoint

export type AuditAction = 
  | 'carer.created'
  | 'carer.updated'
  | 'carer.deleted'
  | 'carer.invited'
  | 'document.uploaded'
  | 'document.approved'
  | 'document.rejected'
  | 'document.deleted'
  | 'document.viewed'
  | 'reminder.created'
  | 'reminder.updated'
  | 'reminder.deleted'
  | 'reminder.toggled'
  | 'email.sent'
  | 'settings.updated'
  | 'user.login'
  | 'user.logout'

export type EntityType = 
  | 'carer'
  | 'document'
  | 'reminder'
  | 'organization'
  | 'user'
  | 'email'

interface AuditLogParams {
  action: AuditAction
  entityType: EntityType
  entityId?: string
  entityName?: string
  details?: Record<string, unknown>
}

// Client-side audit log helper (calls API)
export async function logAction(params: AuditLogParams) {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch (error) {
    console.error('Failed to log action:', error)
  }
}
