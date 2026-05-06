import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const body = await request.json()
    const { action, entityType, entityId, entityName, details } = body

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      null
    const userAgent = request.headers.get('user-agent')

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        user_email: user.email,
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        details: details || {},
        ip_address: ipAddress,
        user_agent: userAgent,
      })

    if (error) {
      console.error('Audit log error:', error)
      return NextResponse.json({ error: 'Failed to log' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Audit API error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
