import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { sendVerificationCodeEmail } from '@/lib/email'
import { parseSocialLink } from '@/lib/parse-social'
import { s3KeyFromUrl } from '@/lib/media-storage'
import { storagePathFromPublicUrl } from '@/lib/storage-path'
import { deleteLiveClipByKey } from '@/lib/s3'

const CODE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const isValidUrl = (url: string) => {
  if (!url.trim()) return true
  try {
    new URL(url.startsWith('http') ? url : `https://${url}`)
    return true
  } catch {
    return false
  }
}
const isValidSocial = (value: string) => {
  if (!value.trim()) return true
  if (value.startsWith('http://') || value.startsWith('https://')) return isValidUrl(value)
  const cleaned = value.trim().replace(/^@/, '')
  return /^[A-Za-z0-9_.-]{1,100}$/.test(cleaned)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          name?: string
          email?: string
          password?: string
          websiteLink?: string
          linkedin?: string
          twitter?: string
          github?: string
          polaroid_still_url?: string
          polaroid_live_url?: string
        }
      | null
    const name = body?.name?.trim() ?? ''
    const email = body?.email?.trim().toLowerCase() ?? ''
    const password = body?.password ?? ''
    const websiteLink = body?.websiteLink?.trim() ?? ''
    const linkedin = body?.linkedin?.trim() ?? ''
    const twitter = body?.twitter?.trim() ?? ''
    const github = body?.github?.trim() ?? ''
    const polaroid_still_url = body?.polaroid_still_url?.trim() ?? ''
    const polaroid_live_url = body?.polaroid_live_url?.trim() ?? ''

    // Validation
    const errors: Record<string, string> = {}
    if (name.length < 2) errors.name = 'Name must be at least 2 characters'
    else if (!/^[a-zA-Z\s']+$/.test(name)) errors.name = 'Name can only contain letters, spaces, and apostrophes'
    if (!email) errors.email = 'Please enter your email address'
    else if (!isValidEmail(email)) errors.email = 'Please enter a valid email address'
    if (!password) errors.password = 'Password is required'
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters'
    if (websiteLink && !isValidUrl(websiteLink)) errors.websiteLink = 'Enter a valid URL'
    const hasAnySocial = linkedin || twitter || github
    if (!hasAnySocial) errors.socials = 'At least one social link is required'
    else {
      if (linkedin && !isValidSocial(linkedin)) errors.linkedin = 'Enter handle or full URL'
      if (twitter && !isValidSocial(twitter)) errors.twitter = 'Enter handle or full URL'
      if (github && !isValidSocial(github)) errors.github = 'Enter handle or full URL'
    }

    if (!polaroid_still_url) errors.polaroidStill = 'Polaroid still photo is required'
    if (!polaroid_live_url) errors.polaroidLive = 'Polaroid live clip is required'

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 })
    }

    // All validation passed — check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('email', email)
      .single()
    if (existing) {
      return NextResponse.json({ errors: { email: 'This email is already registered' } }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(password, 10)

    // Media is uploaded directly from the client. We only persist references here.
    const uploadedStillPath = storagePathFromPublicUrl(polaroid_still_url, 'profile-website-pictures')
    const uploadedLivePath = s3KeyFromUrl(polaroid_live_url)
    if (!uploadedStillPath) {
      return NextResponse.json({ errors: { polaroidStill: 'Invalid still photo URL' } }, { status: 400 })
    }
    if (!uploadedLivePath) {
      return NextResponse.json({ errors: { polaroidLive: 'Invalid live clip URL' } }, { status: 400 })
    }

    const li = parseSocialLink('linkedin', linkedin)
    const tw = parseSocialLink('twitter', twitter)
    const gh = parseSocialLink('github', github)
    const linkedin_handle = li?.username ?? null
    const twitter_handle = tw?.username ?? null
    const github_handle = gh?.username ?? null

    const payload = {
      name,
      email,
      password_hash,
      website_link: websiteLink || null,
      polaroid_still_url,
      polaroid_live_url,
      linkedin_handle,
      twitter_handle,
      github_handle,
    }

    const code = generateVerificationCode()
    const codeExpiresAt = new Date(Date.now() + CODE_EXPIRY_MS).toISOString()

    const { error: insertErr } = await supabaseAdmin.from('pending_signups').insert({
      email,
      payload,
      code,
      code_expires_at: codeExpiresAt,
      polaroid_still_path: uploadedStillPath,
      polaroid_live_path: uploadedLivePath,
    })

    if (insertErr) {
      await supabaseAdmin.storage.from('profile-website-pictures').remove([uploadedStillPath!])
      await deleteLiveClipByKey(uploadedLivePath!)
      console.error('pending_signups insert error:', insertErr)
      return NextResponse.json({ errors: { _: 'Failed to save signup. Please try again.' } }, { status: 500 })
    }

    try {
      await sendVerificationCodeEmail(email, name, code)
    } catch (emailErr) {
      await supabaseAdmin.from('pending_signups').delete().eq('email', email)
      await supabaseAdmin.storage.from('profile-website-pictures').remove([uploadedStillPath!])
      await deleteLiveClipByKey(uploadedLivePath!)
      throw emailErr
    }

    return NextResponse.json(
      { needsVerification: true, email },
      { status: 202 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('Join API error:', message, stack)
    const isDev = process.env.NODE_ENV === 'development'
    const userMsg = isDev && message
      ? `Something went wrong: ${message}`
      : 'Something went wrong. Please try again.'
    return NextResponse.json({ errors: { _: userMsg } }, { status: 500 })
  }
}
