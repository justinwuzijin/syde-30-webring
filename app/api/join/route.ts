import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/token'
import { sendVerificationCodeEmail } from '@/lib/email'
import { parseSocialLink } from '@/lib/parse-social'

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
    const formData = await request.formData()
    const name = (formData.get('name') as string)?.trim() ?? ''
    const email = (formData.get('email') as string)?.trim() ?? ''
    const password = (formData.get('password') as string) ?? ''
    const websiteLink = (formData.get('websiteLink') as string)?.trim() ?? ''
    const linkedin = (formData.get('linkedin') as string)?.trim() ?? ''
    const twitter = (formData.get('twitter') as string)?.trim() ?? ''
    const github = (formData.get('github') as string)?.trim() ?? ''
    const polaroidStill = formData.get('polaroidStill') as File | null
    const polaroidLive = formData.get('polaroidLive') as File | null

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

    if (!polaroidStill || !(polaroidStill instanceof File) || polaroidStill.size === 0) {
      errors.polaroidStill = 'Polaroid still photo is required'
    } else {
      const stillExt = polaroidStill.name.split('.').pop()?.toLowerCase() || 'heic'
      const allowedStill = ['heic', 'heif', 'jpg', 'jpeg', 'png']
      if (!allowedStill.includes(stillExt)) {
        errors.polaroidStill = 'Invalid still image format (use HEIC or JPG/PNG)'
      }
    }

    const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB
    if (!polaroidLive || !(polaroidLive instanceof File) || polaroidLive.size === 0) {
      errors.polaroidLive = 'Polaroid live clip is required'
    } else {
      if (polaroidLive.size > MAX_VIDEO_BYTES) {
        errors.polaroidLive = 'Video is too large (max 50MB). Try a shorter clip.'
      } else {
        const liveExt = polaroidLive.name.split('.').pop()?.toLowerCase() || 'mov'
        const allowedLive = ['mov', 'mp4']
        if (!allowedLive.includes(liveExt)) {
          errors.polaroidLive = 'Invalid live clip format (use MOV or MP4)'
        }
      }
    }

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

    // All validation passed — upload to storage (no DB writes in this route)
    let polaroid_still_url: string | null = null
    let polaroid_live_url: string | null = null
    let uploadedStillPath: string | null = null
    let uploadedLivePath: string | null = null

    const stillExt = polaroidStill!.name.split('.').pop()?.toLowerCase() || 'heic'
    const stillFileName = `${Date.now()}-still-${Math.random().toString(36).slice(2)}.${stillExt}`
    const { data: stillUpload, error: stillErr } = await supabaseAdmin.storage
      .from('profile-website-pictures')
      .upload(stillFileName, polaroidStill!, { contentType: polaroidStill!.type, upsert: false })
    if (stillErr) {
      return NextResponse.json({ errors: { polaroidStill: 'Failed to upload still image' } }, { status: 500 })
    }
    uploadedStillPath = stillUpload.path
    const { data: stillUrlData } = supabaseAdmin.storage
      .from('profile-website-pictures')
      .getPublicUrl(stillUpload.path)
    polaroid_still_url = stillUrlData.publicUrl

    const liveExt = polaroidLive!.name.split('.').pop()?.toLowerCase() || 'mov'
    const liveFileName = `${Date.now()}-live-${Math.random().toString(36).slice(2)}.${liveExt}`
    const { data: liveUpload, error: liveErr } = await supabaseAdmin.storage
      .from('profile-website-pictures')
      .upload(liveFileName, polaroidLive!, { contentType: polaroidLive!.type, upsert: false })
    if (liveErr) {
      await supabaseAdmin.storage.from('profile-website-pictures').remove([uploadedStillPath!])
      console.error('Supabase live clip upload error:', liveErr)
      const msg = liveErr.message?.includes('Payload too large') || liveErr.message?.includes('Entity too large')
        ? 'Video file is too large (max 50MB). Try a shorter clip.'
        : `Failed to upload live clip: ${liveErr.message || 'Unknown error'}`
      return NextResponse.json({ errors: { polaroidLive: msg } }, { status: 500 })
    }
    if (!liveUpload?.path) {
      await supabaseAdmin.storage.from('profile-website-pictures').remove([uploadedStillPath!])
      return NextResponse.json({ errors: { polaroidLive: 'Upload succeeded but no path returned' } }, { status: 500 })
    }
    uploadedLivePath = liveUpload.path
    const { data: liveUrlData } = supabaseAdmin.storage
      .from('profile-website-pictures')
      .getPublicUrl(liveUpload.path)
    polaroid_live_url = liveUrlData.publicUrl

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
      await supabaseAdmin.storage.from('profile-website-pictures').remove([uploadedStillPath!, uploadedLivePath!])
      console.error('pending_signups insert error:', insertErr)
      return NextResponse.json({ errors: { _: 'Failed to save signup. Please try again.' } }, { status: 500 })
    }

    try {
      await sendVerificationCodeEmail(email, name, code)
    } catch (emailErr) {
      await supabaseAdmin.from('pending_signups').delete().eq('email', email)
      await supabaseAdmin.storage.from('profile-website-pictures').remove([uploadedStillPath!, uploadedLivePath!])
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
