import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { Resend } from 'resend'

const requestSchema = z.object({
  carerId: z.string().uuid(),
  carerEmail: z.string().email(),
  carerName: z.string(),
  documentType: z.string(),
  rejectionReason: z.string(),
  inviteToken: z.string().uuid().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = requestSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    const { carerId, carerEmail, carerName, documentType, rejectionReason, inviteToken } = result.data

    // Get or create an invite token for the carer
    let token = inviteToken
    
    if (!token) {
      // Generate new invite token
      token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30 days expiry
      
      const { error: updateError } = await supabase
        .from('carers')
        .update({
          invite_token: token,
          invite_expires_at: expiresAt.toISOString(),
        })
        .eq('id', carerId)
      
      if (updateError) {
        console.error('Failed to update invite token:', updateError)
        return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 })
      }
    }

    // Get organization info for the email
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, organizations(name)')
      .eq('id', user.id)
      .single()

    const organizationName = (profile?.organizations as { name: string } | null)?.name || 'Your Care Agency'
    
    // Build the onboarding URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000'
    const onboardingUrl = `${baseUrl}/onboarding/${token}`

    // Prepare email content
    const emailHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: #1a1a2e; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 20px;">
            C
          </div>
        </div>
        
        <h1 style="color: #1a1a2e; font-size: 24px; font-weight: 600; margin-bottom: 24px; text-align: center;">
          Document Review Update
        </h1>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
          Hi ${carerName},
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Your <strong>${documentType}</strong> document submitted to <strong>${organizationName}</strong> has been reviewed and requires your attention.
        </p>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="color: #991b1b; font-weight: 600; margin: 0 0 8px 0; font-size: 14px;">
            Reason for rejection:
          </p>
          <p style="color: #7f1d1d; margin: 0; font-size: 15px; line-height: 1.5;">
            ${rejectionReason}
          </p>
        </div>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
          Please upload a new document to complete your compliance requirements.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${onboardingUrl}" style="display: inline-block; background: #1a1a2e; color: white; padding: 16px 32px; border-radius: 10px; text-decoration: none; font-weight: 500; font-size: 16px;">
            Upload New Document
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
          This link will expire in 30 days. If you have any questions, please contact your agency directly.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 40px 0 24px;">
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          This email was sent by ${organizationName} via CareComply.
        </p>
      </div>
    `

    // Check if Resend is configured
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      const { error: emailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'CareComply <onboarding@resend.dev>',
        to: carerEmail,
        subject: `Action Required: Your ${documentType} document needs attention`,
        html: emailHtml,
      })

      if (emailError) {
        console.error('Failed to send email:', emailError)
        // Don't fail the request, just log the error
      }
    } else {
      // Log the email for development
      console.log('[CareComply] Email would be sent (RESEND_API_KEY not configured):', {
        to: carerEmail,
        subject: `Action Required: Your ${documentType} document needs attention`,
        onboardingUrl,
      })
    }

    // Log the reminder in the database
    const { data: reminder } = await supabase
      .from('reminders')
      .select('id')
      .eq('organization_id', profile?.organization_id)
      .eq('trigger_type', 'manual')
      .limit(1)
      .single()

    await supabase.from('reminder_logs').insert({
      reminder_id: reminder?.id || null,
      carer_id: carerId,
      channel: 'email',
      status: process.env.RESEND_API_KEY ? 'sent' : 'pending',
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Rejection notification sent',
      emailSent: !!process.env.RESEND_API_KEY,
      // In development, include the URL for testing
      ...(process.env.NODE_ENV !== 'production' && { onboardingUrl })
    })

  } catch (error) {
    console.error('Error sending rejection email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
