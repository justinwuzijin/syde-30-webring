import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/token'
import { sendApprovalEmail } from '@/lib/email'
import { deleteLiveClipByKey } from '@/lib/s3'

const CODE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string)?.trim() ?? ''
    const code = (body.code as string)?.trim() ?? ''

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and verification code are required' },
        { status: 400 }
      )
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Code must be 6 digits' },
        { status: 400 }
      )
    }

    const { data: pending, error: fetchErr } = await supabaseAdmin
      .from('pending_signups')
      .select('id, payload, code, code_expires_at, polaroid_still_path, polaroid_live_path')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchErr || !pending) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 }
      )
    }

    const expiresAt = new Date(pending.code_expires_at).getTime()
    if (expiresAt < Date.now()) {
      await supabaseAdmin.from('pending_signups').delete().eq('id', pending.id)
      if (pending.polaroid_still_path) {
        await supabaseAdmin.storage
          .from('profile-website-pictures')
          .remove([pending.polaroid_still_path])
      }
      if (pending.polaroid_live_path) await deleteLiveClipByKey(pending.polaroid_live_path)
      return NextResponse.json(
        { error: 'Code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    if (pending.code !== code) {
      return NextResponse.json(
        { error: 'Invalid code. Please check and try again.' },
        { status: 400 }
      )
    }

    const payload = pending.payload as {
      name: string
      email: string
      password_hash: string
      website_link: string | null
      polaroid_still_url: string | null
      polaroid_live_url: string | null
      linkedin_handle: string | null
      twitter_handle: string | null
      github_handle: string | null
    }

    const token = signToken(payload)
    // Prefer explicit base URL; on Vercel use deployment URL if BASE_URL is localhost
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      const vercelUrl = process.env.VERCEL_URL
      if (vercelUrl) {
        baseUrl = `https://${vercelUrl}`
      } else {
        baseUrl = 'https://syde-30-webring-eta.vercel.app'
      }
    }
    const approveUrl = `${baseUrl.replace(/\/$/, '')}/api/approve?token=${token}`

    const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER
    if (!adminEmail) {
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      )
    }

    await sendApprovalEmail(adminEmail, {
      name: payload.name,
      email: payload.email,
      website_link: payload.website_link,
      polaroid_still_url: payload.polaroid_still_url,
      polaroid_live_url: payload.polaroid_live_url,
      linkedin_handle: payload.linkedin_handle,
      twitter_handle: payload.twitter_handle,
      github_handle: payload.github_handle,
    }, approveUrl)

    await supabaseAdmin.from('pending_signups').delete().eq('id', pending.id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Verify signup error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
