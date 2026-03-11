import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendVerificationCodeEmail } from '@/lib/email'

const CODE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string)?.trim() ?? ''

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const { data: pending, error: fetchErr } = await supabaseAdmin
      .from('pending_signups')
      .select('id, payload')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchErr || !pending) {
      return NextResponse.json(
        { error: 'No pending signup found for this email. Please sign up again.' },
        { status: 400 }
      )
    }

    const payload = pending.payload as { name: string }
    const code = generateVerificationCode()
    const codeExpiresAt = new Date(Date.now() + CODE_EXPIRY_MS).toISOString()

    const { error: updateErr } = await supabaseAdmin
      .from('pending_signups')
      .update({ code, code_expires_at: codeExpiresAt })
      .eq('id', pending.id)

    if (updateErr) {
      return NextResponse.json(
        { error: 'Failed to generate new code. Please try again.' },
        { status: 500 }
      )
    }

    await sendVerificationCodeEmail(email, payload.name, code)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Resend verification error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
