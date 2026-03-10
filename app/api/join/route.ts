import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/token'
import { sendApprovalEmail } from '@/lib/email'
import { parseSocialLink } from '@/lib/parse-social'

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
    const profilePicture = formData.get('profilePicture') as File | null

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

    if (!profilePicture || !(profilePicture instanceof File) || profilePicture.size === 0) {
      errors.profilePicture = 'Profile picture is required'
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 })
    }

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('email', email)
      .single()
    if (existing) {
      return NextResponse.json({ errors: { email: 'This email is already registered' } }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(password, 10)

    let profile_picture_url: string | null = null
    if (profilePicture && profilePicture.size > 0) {
      const ext = profilePicture.name.split('.').pop()?.toLowerCase() || 'jpg'
      const allowed = ['jpg', 'jpeg', 'png', 'webp']
      if (!allowed.includes(ext)) {
        return NextResponse.json({ errors: { profilePicture: 'Invalid image format' } }, { status: 400 })
      }
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: upload, error: uploadErr } = await supabaseAdmin.storage
        .from('profile-website-pictures')
        .upload(fileName, profilePicture, { contentType: profilePicture.type, upsert: false })
      if (uploadErr) {
        return NextResponse.json({ errors: { profilePicture: 'Failed to upload image' } }, { status: 500 })
      }
      const { data: publicUrl } = supabaseAdmin.storage
        .from('profile-website-pictures')
        .getPublicUrl(upload.path)
      profile_picture_url = publicUrl.publicUrl
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
      profile_picture_url,
      linkedin_handle,
      twitter_handle,
      github_handle,
    }

    const token = signToken(payload)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const approveUrl = `${baseUrl}/api/approve?token=${token}`

    const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER
    if (!adminEmail) {
      return NextResponse.json({ errors: { _: 'Server misconfiguration: ADMIN_EMAIL missing' } }, { status: 500 })
    }
    await sendApprovalEmail(adminEmail, {
      name,
      email,
      website_link: websiteLink || null,
      profile_picture_url,
      linkedin_handle,
      twitter_handle,
      github_handle,
    }, approveUrl)

    return new NextResponse(null, { status: 202 })
  } catch (err) {
    console.error('Join API error:', err)
    return NextResponse.json({ errors: { _: 'Something went wrong' } }, { status: 500 })
  }
}
