import { NextResponse } from 'next/server'

export async function GET() {
  const configured = !!process.env.RESEND_API_KEY
  return NextResponse.json({ configured })
}
